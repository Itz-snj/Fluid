# Fluid Architecture

Detailed system architecture, flow diagrams, and operational guide.

> **Status:** Phase 1 + Phase 2 complete and hardened. The codebase is now a Bun workspace split into three publishable packages (`@fluid/core`, `@fluid/engine`, `@fluid/react`) plus an in-tree showcase app at `apps/engine`. Phase 3 (separate consumer demo app) is queued.

---

## Workspace layout

```
genUI/
├── packages/
│   ├── fluid-core/      → @fluid/core   IR + Schema + semantic validation
│   ├── fluid-engine/    → @fluid/engine LLM bridge + adapters + createEngine()
│   └── fluid-react/     → @fluid/react  FluidView + fetchIR + useFluidIR
└── apps/
    └── engine/          → @fluid-app/engine  Next.js 16 showcase app
```

- **`@fluid/core`** has no runtime dependencies beyond Zod. It defines what IR is and what makes a valid schema. The LLM never sees this code; it's the spec the LLM is held to.
- **`@fluid/engine`** is BYOK (Bring Your Own Key). It owns prompt construction, the LLM call, the IR cache, the rate limiter, and the retry-with-feedback loop. It does **not** own a database. All persistence is plugged in via adapter interfaces.
- **`@fluid/react`** is rendering only. Server-safe `FluidView` plus client-side `fetchIR` + `useFluidIR` so consumers don't hand-roll the fetch.
- **`apps/engine`** wires the three packages into a working Next 16 app — server route, intent box, archetype switcher, smoke script. It's both the demo and a reference integration.

---

## Distribution & cost model — BYOK + adapters

Fluid is a library, not a hosted service. The consumer's Next.js (or Node) process runs the engine in its own server runtime. The consumer pays Anthropic directly; nothing flows through Fluid-owned infrastructure.

```
┌─────────────────────────────────────────────────────────────────┐
│                Consumer's Next.js process                       │
│                                                                  │
│   getEngine()                                                   │
│     └── createEngine({ apiKey, cache?, rateLimiter? })          │
│           ├── @fluid/engine (this package)                      │
│           ├── consumer's CacheAdapter (or default in-memory)    │
│           └── consumer's RateLimiter  (or default in-memory)    │
│                                                                  │
│   /api/generate  ──▶  engine.generate({ schema, intent })       │
│                          │                                       │
│                          ▼                                       │
│                  Anthropic (consumer's API key)                 │
└─────────────────────────────────────────────────────────────────┘
```

**Why this matters:**
- No env reads inside the library. `createEngine({ apiKey })` is explicit.
- Default in-memory adapters work for dev/demos/single-instance prod with zero setup.
- Swap `cache` for Redis/Upstash, or `rateLimiter` for a distributed one, by passing objects matching the published interfaces. No fork required.
- A custom `provider: LLMProvider` slot exists for swapping Anthropic for OpenAI/Gemini/etc.

---

## What is the IR?

**IR = Intermediate Representation.** It's the most important concept in this codebase, and it's not a component.

It's plain JSON — a declarative tree describing **what** to show, never **how**. Concretely:

```json
{
  "version": 1,
  "archetype": "lawyer",
  "schema": "tasks",
  "root": {
    "type": "stack",
    "direction": "col",
    "children": [
      { "type": "heading", "text": "Matters & References", "level": 1 },
      {
        "type": "split",
        "ratio": "2:1",
        "left":  { "type": "list", "query": { "entity": "Task", ... }, "item": { ... } },
        "right": { "type": "list", "query": { "entity": "Snippet", ... }, "item": { ... } }
      }
    ]
  }
}
```

It is:

- **Inert.** No functions, no event handlers, no JSX, no CSS — just data.
- **Sandboxed.** Can only reference entities and fields the developer declared in `.fluid.ts`.
- **Validated.** Zod proves shape; `checkIRAgainstSchema` proves references resolve.
- **Cacheable.** It's just JSON, so it serializes cleanly into Redis or Postgres.

### Why an IR at all? Why not have the LLM emit React directly?

1. **Security.** If the LLM emitted JSX or HTML, you'd be running its output. With IR, the LLM produces *data*; the renderer (which you wrote) decides what HTML/CSS that data becomes.
2. **Validation.** Plain JSON can be checked by Zod and a semantic walker before rendering. JSX can't be validated meaningfully.
3. **Portability.** Same IR can render to web React today, React Native tomorrow, plain HTML email next week. The renderer is swappable; the IR is the contract.

```
Intent (natural language)        ← what the user wants
       ↓ LLM
IR (declarative JSON tree)       ← the contract / the moat
       ↓ Renderer
React tree                       ← what the user sees
       ↓ Next.js SSR
HTML                             ← what's on the wire
```

**The IR is the IP.** Anyone can call Claude. Few will design a JSON grammar expressive enough that intent → JSON → UI works reliably across thousands of intents.

---

## End-to-End Flow

### Preset Archetype Path (no LLM)

```
┌──────────┐    ┌──────────────┐    ┌────────────────┐    ┌─────────────┐
│  Browser │───▶│  page.tsx    │───▶│ getArchetype() │───▶│ Hardcoded   │
│  GET /   │    │  (RSC)       │    │                │    │ IR JSON     │
└──────────┘    └──────────────┘    └────────────────┘    └──────┬──────┘
                       │                                          │
                       ▼                                          │
                ┌──────────────┐    ┌────────────────┐           │
                │ schema       │───▶│ endpoint.fetch │           │
                │ endpoints    │    │ () → data      │           │
                └──────────────┘    └────────┬───────┘           │
                                             │                    │
                                             ▼                    ▼
                                       ┌──────────────────────────────┐
                                       │   <FluidView ir data />      │
                                       │   (@fluid/react)             │
                                       │  ┌────────────────────────┐  │
                                       │  │ Zod validate IR        │  │
                                       │  └──────────┬─────────────┘  │
                                       │             ▼                │
                                       │  ┌────────────────────────┐  │
                                       │  │ renderNode() recursive │  │
                                       │  └──────────┬─────────────┘  │
                                       │             ▼                │
                                       │  ┌────────────────────────┐  │
                                       │  │ React tree → SSR HTML  │  │
                                       │  └────────────────────────┘  │
                                       └──────────────────────────────┘
```

### Live Generation Path (with LLM)

```
┌──────────────┐
│   Browser    │
│ IntentBox UI │ ──── (or any consumer using useFluidIR)
└──────┬───────┘
       │ POST { intent, userId? }
       ▼
┌──────────────────────────────────────┐
│  /api/generate (route.ts)            │
│                                      │
│  1. getEngine() (lazy singleton)     │
│     ↳ no key → 500                   │
│  2. engine.checkRateLimit(`gen:${ip}`)│
│     ↳ over → 429 + Retry-After       │
│  3. Zod parse body                   │
│     ↳ bad → 400                      │
│  4. Set up AbortController           │
│     ↳ 90s server timeout             │
│     ↳ client disconnect → abort      │
│  5. engine.generate({ schema, intent,│
│                       userId, signal })│
└──────┬───────────────────────────────┘
       │
       ▼
┌─────────────────────────────┐
│  generate.ts (orchestrator) │
│                             │
│  Build cache key:           │
│  ir:{schema}[:{userId}]:    │
│     {sha256(intent)[:16]}   │
└──────┬──────────────────────┘
       │
       ▼
┌─────────────────────────────┐         ┌──────────────────┐
│   CacheAdapter.get(key)     │  HIT    │ Return cached IR │
│   (default: in-memory       │────────▶│ cached: true     │
│    LRU 500 + TTL 1h)        │         │ attempts: 0      │
└──────┬──────────────────────┘         └──────────────────┘
       │ MISS
       ▼
┌─────────────────────────────┐
│  cache.singleFlight(key,fn) │ ← concurrent identical intents
│  → one Promise shared       │   share one LLM call
└──────┬──────────────────────┘
       │
       ▼
┌─────────────────────────────┐
│       prompt.ts             │
│                             │
│  Build system prompt:       │
│  • IR grammar rules         │
│  • Schema JSON (stable)     │
│  • Cache breakpoint here    │
└──────┬──────────────────────┘
       │
       ▼
┌─────────────────────────────┐
│   LLMProvider (injected)    │
│   default: AnthropicProvider│
│   (apiKey from createEngine)│
└──────┬──────────────────────┘
       │
       ▼
┌─────────────────────────────────────────────────┐
│             anthropic.ts                         │
│                                                  │
│  client.messages.stream({                       │
│    model: "claude-opus-4-7",                    │
│    max_tokens: 16000,                           │
│    thinking: { type: "adaptive" },              │
│    output_config: { effort: "xhigh" },          │
│    system: [{                                   │
│      text: systemPrompt,                        │
│      cache_control: { type: "ephemeral" }      │
│    }],                                          │
│    messages: [{ role: "user", content: intent }]│
│  }, { signal })  ← AbortSignal forwarded        │
└──────┬──────────────────────────────────────────┘
       │
       ▼
┌─────────────────────────────┐
│   Claude Opus 4.7           │
│   (extended thinking)       │
│                             │
│   • Reads schema            │
│   • Reasons about intent    │
│   • Emits JSON IR           │
└──────┬──────────────────────┘
       │
       ▼
┌─────────────────────────────────────┐
│   generate.ts (continued)           │
│                                     │
│   1. parseIR(text):                 │
│      • Try direct JSON.parse        │
│      • Strip ```json fences         │
│      • Extract balanced { ... }     │
│   2. validateIR (Zod shape)         │
│   3. checkIRAgainstSchema           │
│      (entity/field/enum sandbox)    │
└──────┬──────────────────────────────┘
       │
       ├─── FAIL ──▶ Retry once with tagged error:
       │             ("schema-violation" | "invalid-json" | "invalid-ir")
       │
       │ SUCCESS
       ▼
┌─────────────────────────────┐
│   CacheAdapter.set(key, ir) │
│   (default: LRU evict > 500)│
└──────┬──────────────────────┘
       │
       ▼
┌─────────────────────────────────────┐
│   Structured telemetry              │
│   logGeneration({                   │
│     ok, ip, key, cached, attempts,  │
│     latencyMs, usage                │
│   })                                │
└──────┬──────────────────────────────┘
       │
       ▼
┌─────────────────────────────┐
│   API Response              │
│   { ir, cached, usage,      │
│     latencyMs, attempts }   │
└──────┬──────────────────────┘
       │
       ▼
┌─────────────────────────────┐
│   IntentBox / useFluidIR    │
│                             │
│   <FluidView ir data />     │
│   → Renders personalized UI │
└─────────────────────────────┘
```

---

## Layer Boundaries

### Boundary 1: Schema → Engine

**Input**: Schema reads as JSON (entities, fields, endpoints metadata).
**Output**: System prompt teaching the LLM what's possible.
**Contract**: LLM can only reference declared entities and fields.

### Boundary 2: LLM → Renderer

**Input**: LLM emits raw JSON text.
**Validation**: Zod schema enforces structure, field references, version.
**Output**: Typed `FluidIR` object — or error sent back to LLM for retry.

### Boundary 3: IR → React

**Input**: Validated `FluidIR`.
**Process**: Recursive `renderNode()` switch over node types.
**Output**: React element tree → SSR HTML.

---

## Module Responsibilities

| Module | Package | Responsibility | Touched by LLM? |
|---|---|---|---|
| `src/ir.ts` | `@fluid/core` | IR type definitions + Zod schemas | No (defines validation) |
| `src/schema.ts` | `@fluid/core` | `defineSchema()` runtime, entity/endpoint types | No |
| `src/validate.ts` | `@fluid/core` | `checkIRAgainstSchema` (semantic sandbox) + IR limits (depth, node count) | No |
| `src/adapters.ts` | `@fluid/engine` | `CacheAdapter` / `RateLimiter` interfaces | No |
| `src/engine.ts` | `@fluid/engine` | `createEngine({ apiKey, cache?, rateLimiter?, provider? })` factory | No |
| `src/prompt.ts` | `@fluid/engine` | Build system prompt from schema | No (produces LLM input) |
| `src/llm/provider.ts` | `@fluid/engine` | Provider-agnostic interface (with `AbortSignal`) | No |
| `src/llm/anthropic.ts` | `@fluid/engine` | Anthropic SDK calls — streaming, prompt caching, abort. Constructor takes `apiKey` | Sends/receives |
| `src/cache.ts` | `@fluid/engine` | `intentKey(schema, intent, userId?)` + `createMemoryCache()` (LRU + TTL + single-flight) | No |
| `src/rate-limit.ts` | `@fluid/engine` | `createMemoryRateLimiter()` — sliding-window in-memory limiter, no module-level state | No |
| `src/generate.ts` | `@fluid/engine` | Orchestrate cache → LLM → parse → validate → retry. Pure function over injected `{ provider, cache }` | Receives + validates |
| `src/data.ts` | `@fluid/react` | `runQuery`, `groupRows`, `resolveBinding` (type-aware compare) | No |
| `src/render.tsx` | `@fluid/react` | Recursive IR → React | No (consumes validated IR) |
| `src/FluidView.tsx` | `@fluid/react` | Public component: Zod + (optional) semantic validation before render | No (defensive validation) |
| `src/fetchIR.ts` | `@fluid/react` | Typed fetch wrapper over the consumer's `/api/generate` | No |
| `src/useFluidIR.ts` | `@fluid/react` | Client hook: re-fetches on intent/userId change, manages AbortController, exposes `refetch` | No |
| `apps/engine/src/lib/engine.ts` | app | Lazy `getEngine()` singleton — reads `ANTHROPIC_API_KEY`, calls `createEngine` | No |
| `apps/engine/src/app/api/generate/route.ts` | app | HTTP entrypoint: Zod body, rate limit via engine, abort, telemetry | No |
| `apps/engine/src/archetypes/{lawyer,engineer,pm}.ir.ts` | app | Preset IRs — demo evidence + cold-start fallbacks + grammar fixtures | No |

---

## Data Flow Examples

### Example 1: Cache hit

```
User types: "tasks grouped by matter"
  ↓
Hash: ir:tasks:a3f1e9b2c4d5e6f7
  ↓
cache.get(key) → found
  ↓
Return { ir, cached: true, latencyMs: 2 }
  ↓
Render in <50ms
```

### Example 2: Cache miss, generation success

```
User types: "show me overdue tasks as a checklist"
  ↓
Hash: ir:tasks:b7d2c8a9e3f4d5e6
  ↓
cache.get(key) → miss
  ↓
buildPrompt(schema) → systemPrompt (cached)
  ↓
provider.generate({ systemPrompt, userMessage: intent })
  ↓
Claude streams JSON with thinking
  ↓
stripCodeFences(text) → JSON.parse → Zod.parse
  ↓
cache.set(key, ir)
  ↓
Return { ir, cached: false, usage, latencyMs: 8200 }
```

### Example 3: Validation failure + retry

```
User intent → Claude → Invalid IR (references undeclared field)
  ↓
Zod.parse() throws ZodError
  ↓
Retry with error feedback:
  "Previous attempt failed validation: 'Task.unknownField' not declared.
   Retry with only declared fields."
  ↓
Claude re-emits with valid fields → success
```

---

## Caching Strategy

Three caches in the system. They sit at different layers and solve different problems — keep them separate in your head.

### Cache A — Application IR cache (consumer-pluggable)

`packages/fluid-engine/src/cache.ts` — `createMemoryCache()` is the default; consumers can swap it.

- **What's cached:** the fully validated `FluidIR` JSON tree, after Zod + semantic checks pass.
- **Key:** `ir:{schemaName}[:{userId}]:{sha256(normalized_intent)[:16]}` — `intentKey(schema, intent, userId?)`.
- **Storage (default):** Node.js process memory `Map`. Dies on server restart.
- **TTL (default):** 1 hour.
- **Capacity (default):** LRU-bounded to 500 entries — oldest by last-read time is evicted.
- **Single-flight:** if N concurrent requests arrive for the same key, only one runs the LLM call; the rest await its Promise. Implemented as an optional method on `CacheAdapter` — `generate.ts` uses it if present, falls back to direct invocation otherwise.
- **Multi-instance prod:** pass a Redis/Upstash adapter to `createEngine({ cache })`. Same `{ get, set, singleFlight? }` shape.

> **Per-user namespacing is opt-in.** Callers pass `userId` into `engine.generate()` to scope cache entries; omit it and entries are globally shared across users for the same `(schema, intent)`.

### Cache B — Anthropic prompt cache (provider-side)

`packages/fluid-engine/src/llm/anthropic.ts`

- **What's cached:** the *tokenized* system prompt (grammar + serialized schema), inside Anthropic's infrastructure.
- **Trigger:** the `cache_control: { type: "ephemeral" }` breakpoint at the end of the system prompt.
- **TTL:** 5 minutes.
- **Effect:** within 5 min, repeat input tokens for the cached prefix cost ~10% of normal.
- **Verified at runtime** via `usage.cache_read_input_tokens` (surfaced in the IntentBox UI).

### Cache C — Client-side IR cache (consumer's UI)

Lives in the consumer's app, not in any Fluid package. `useFluidIR` keeps the last successful IR in component state but does **not** persist across navigation. For richer caching (revalidate-on-focus, mutation invalidation, etc.), consumers wrap `fetchIR` in React Query / SWR.

### How the three interact

| Scenario | Cache A (IR) | Cache B (prompt) | Cache C (client) | LLM call? |
|---|---|---|---|---|
| First-ever request | miss | miss | empty | yes (full cost) |
| Same intent, within 1h | **hit** | n/a | served from A | **no** |
| Different intent, within 5 min | miss | hit | new fetch | yes (cheap input) |
| Different intent, after 5 min | miss | miss | new fetch | yes (full cost) |
| Component remount, same key | maybe hit | n/a | depends on consumer | depends on A |

### Cache key normalization

```typescript
intent.trim().toLowerCase().replace(/\s+/g, " ")
  → sha256 → slice(0, 16)
```

Whitespace and case differences collapse to the same key. `"  Show TASKS "` == `"show tasks"`.

---

## Where intent profiles live (and the per-user gap)

Today the engine is **stateless per request**. The intent string carries everything. `userId` plumbs through the API → engine → cache key, but nothing is persisted.

**Already wired:**

| Concept | Where it lives | Notes |
|---|---|---|
| `userId` on the request | `/api/generate` body | Optional; client decides |
| Cache key including userId | `ir:{schema}:{userId}:{intentHash}` | Engine-side; opt-in via `engine.generate({ userId })` |

**Not implemented yet (Phase 3):**

| Concept | Where it will live | Notes |
|---|---|---|
| Persisted intent profile | Consumer's DB (Postgres/Convex/Supabase) via a `ProfileStore` adapter | Today: nowhere |
| "Refine my UI" feedback loop | New endpoint + ProfileStore writes | Today: regenerate-only |
| Profile-aware prompt | `buildSystemPrompt(schema, profile?)` | Today: schema-only |

The cleanest integration point is *inside* the consumer's `/api/generate`, before `engine.generate`:

```
client → /api/generate { userId, intent }
         ↓
         API: 1. resolve userId → load intent profile (ProfileStore.get)
              2. merge profile + new intent
              3. write merged profile back (ProfileStore.set)
              4. call engine.generate({ schema, intent: merged, userId })
```

Same shape as the existing adapter pattern — `ProfileStore` would join `CacheAdapter` and `RateLimiter` as a third pluggable interface.

---

## Security Model

### Sandbox guarantees

The IR is **the** security boundary. Even a fully adversarial LLM cannot:

1. **Reference undeclared entities/fields** — `checkIRAgainstSchema` in `packages/fluid-core/src/validate.ts` walks the IR and rejects any unknown entity/field reference. Zod proves shape; this proves *meaning*.
2. **Use enum values outside the schema** — kanban `columns` and similar enum-valued fields are checked against `entity.fields[field].values`.
3. **Call unauthorized endpoints** — Renderer only invokes `schema.endpoints[name].fetch()`; no arbitrary URL fetching.
4. **Inject HTML/script** — Renderer maps IR nodes to React elements; no `dangerouslySetInnerHTML`.
5. **Read server secrets** — Engine runs server-side; only the validated IR crosses to the client. The Anthropic key never leaves the server process — `@fluid/engine` is server-only.
6. **Trigger side effects** — `fetch` functions are developer-authored; the LLM names them, doesn't define them.
7. **Blow up the renderer** — IR is bounded to `maxDepth = 16` and `maxNodes = 256`.
8. **Spam the engine** — `engine.checkRateLimit(key)` enforces 20 requests/min by default; consumer chooses the key (typically IP).
9. **Hang a worker** — every LLM call is wrapped in an `AbortController` with a 90s server timeout; client disconnect aborts the upstream call.

### Failure modes

| Failure | Detection | Recovery |
|---|---|---|
| Invalid JSON in LLM output | `parseIR()` fallback chain throws | Retry tagged `invalid-json` |
| Shape mismatch | `validateIR()` (Zod) throws | Retry tagged `invalid-ir` |
| Undeclared entity/field/enum | `checkIRAgainstSchema()` throws `IRSemanticError` | Retry tagged `schema-violation` |
| IR exceeds depth/node limits | `checkIRAgainstSchema()` throws | Retry tagged `schema-violation` |
| Rate-limited client | `engine.checkRateLimit()` returns `ok: false` | 429 + `Retry-After` |
| Server timeout / client disconnect | `AbortController` fires | 504 |
| LLM unavailable / API error | Provider throws | 502 |
| Missing API key | `createEngine` throws on first use | 500 |
| Generation fails twice | Final throw in `generate.ts` | 502 with `detail` |

---

## Performance Profile

### Cold path (cache miss, fresh prompt cache)

```
Total: ~8-15s
├── Build prompt: ~5ms
├── API call setup: ~50ms
├── Claude thinking + generation: ~7-13s
├── Stream consumption: ~100ms
├── Parse + validate: ~10ms
└── Cache write: ~1ms
```

### Warm path (cache miss, hot prompt cache)

```
Total: ~5-10s
├── Same as cold, but ~30-40% cheaper input tokens
└── Slightly faster TTFT
```

### Hot path (IR cache hit)

```
Total: <50ms
├── Hash compute: ~1ms
├── Map lookup: ~0ms
└── JSON response: ~5ms
```

---

## Extension Points

### Add a new IR node type

1. Add type to `packages/fluid-core/src/ir.ts` (TypeScript + Zod)
2. Add render branch to `packages/fluid-react/src/render.tsx`
3. Document in system prompt (`packages/fluid-engine/src/prompt.ts`)

### Add a new LLM provider

1. Implement `LLMProvider` (from `@fluid/engine`) in a new file
2. Pass an instance via `createEngine({ provider })` — takes precedence over `apiKey`

### Add a new schema

In the consumer app:

1. Create `src/schemas/{name}.fluid.ts`
2. Call `defineSchema({...})` from `@fluid/core`
3. Hand the schema to `engine.generate({ schema, intent })`

### Swap cache backend (e.g. Redis)

1. Implement `CacheAdapter` from `@fluid/engine`
2. Pass via `createEngine({ cache: myRedisAdapter })`

The default in-memory adapter is single-process and dies on restart — fine for dev/demo, fine for single-instance prod, not fine for horizontal scaling.

### Swap rate limiter

1. Implement `RateLimiter` from `@fluid/engine`
2. Pass via `createEngine({ rateLimiter: myDistributedLimiter })`

---

## Preset archetypes — demo vs. architecture

The three preset IRs in `apps/engine/src/archetypes/{lawyer,engineer,pm}.ir.ts` serve **three distinct roles**. One is demo-only; two survive into production.

| Role | Demo-only? | Why it exists |
|---|---|---|
| **Demo evidence** | Yes | Proves the renderer can produce radically different layouts from the same schema and data, *before* you trust the LLM. Answers "is the IR grammar actually expressive enough?" |
| **Cold-start fallbacks** | **No (architectural)** | A brand-new user has no intent history. The mitigation is a small library of preset archetypes — pick the closest match on day one, refine from real usage. These three IRs are the proof-of-concept seeds of that library. |
| **Grammar regression fixtures** | **No (architectural)** | `apps/engine/scripts/smoke.ts` validates all three against the schema on every CI run. If you add a new node type and break old IRs, this catches it. |

In production, the *content* of these three files is demo-flavored. The *role* (cold-start presets + grammar fixtures) is architectural and survives a rewrite.

---

## What `/api/generate` does, explicitly

`apps/engine/src/app/api/generate/route.ts` is the only HTTP entrypoint into the engine in the showcase app. End-to-end, in order:

1. **Resolve the engine** — `getEngine()` lazy-builds a singleton via `createEngine({ apiKey: process.env.ANTHROPIC_API_KEY })`. Missing key → 500.
2. **Capture start time and client IP** (for telemetry + rate-limit key).
3. **Rate-limit check** — `engine.checkRateLimit(`gen:${ip}`)`. Over limit → 429 with `Retry-After`.
4. **JSON body parse** — invalid → 400.
5. **Zod input validation** — `intent` 1-2000 chars, optional `userId` (≤128 chars), optional `bypassCache` boolean. Bad input → 400 with detail.
6. **Abort plumbing** — `AbortController` wired to both a 90s server timeout *and* `req.signal` (client disconnect). Forwarded down through `engine.generate` → `provider.generate` → the Anthropic SDK.
7. **Call the engine** — `engine.generate({ schema: taskSchema, intent, userId, bypassCache, signal })`. This is the substantive line; everything else is plumbing.
8. **Log + respond** — structured single-line JSON log; success → 200 with `{ ir, cached, usage, latencyMs, attempts }`; abort → 504; LLM failure → 502.

**What it does NOT do (yet):**

- Read or write any DB (no DB in the showcase app).
- Authenticate the user — `userId` is opt-in client metadata, not a session.
- Pick a schema dynamically — `taskSchema` is hardcoded. A real consumer dispatches per route or per request.

---

## Where the database lives

**Fluid does not own a database.** That's intentional, and unchanged by the workspace split.

| What | Where it lives | Notes |
|---|---|---|
| App data (Task, Snippet) | Showcase: hardcoded arrays in `tasks.fluid.ts`. Real consumers: their own DB, exposed via `endpoint.fetch()` | `@fluid/core` never touches this |
| Generated IRs | `CacheAdapter` — default in-memory, swap for Redis | Consumer picks |
| Intent profiles per user | Future `ProfileStore` adapter — not implemented | Consumer picks |
| Rate-limit state | `RateLimiter` — default in-memory, swap for Redis | Consumer picks |
| IR version history | Doesn't exist | Future ProfileStore concern |

**Important distinction:** Fluid never owns the developer's application data. Tasks live in the developer's DB. Any Fluid-flavored persistence (IR cache, intent profiles) is a small metadata store the developer also owns, plugged in via adapter. The `endpoint.fetch()` pattern is the bridge for app data; `CacheAdapter` / `RateLimiter` / future `ProfileStore` are the bridges for engine state.

---

## Why this shape vs. static per-user-type views

| Concern | Static views per user type | Fluid |
|---|---|---|
| **New user type** | New file, new tests, new design | Type intent, render |
| **New feature** | Ship in N variants | Add to schema once |
| **Bug fix** | Touch N files | Touch 1 file |
| **Personalization depth** | Coarse (role-based) | Fine (intent-based) |
| **Cold start** | Need to know users | Adapts from day one |
| **Scale** | Linear in user types | Constant developer surface |
| **Risk** | None (deterministic) | LLM hallucination (mitigated by IR sandbox) |

---

## Glossary

- **IR** — Intermediate Representation. Sandboxed JSON tree the LLM emits and the renderer consumes.
- **Schema** — Developer-authored capability declaration (`.fluid.ts` file).
- **Archetype** — A named preset IR (e.g., "lawyer", "engineer", "pm") used for demos and cold-start defaults.
- **Intent** — Freeform string describing how a user wants to work.
- **Engine** — The LLM bridge: prompt + provider + cache + validator. Constructed via `createEngine()`.
- **Renderer** — Recursive React component tree builder from IR.
- **Adapter** — A pluggable backing store (`CacheAdapter`, `RateLimiter`) the consumer supplies to `createEngine`. Defaults are in-memory; production swaps for Redis/Upstash.
- **BYOK** — Bring Your Own Key. The consumer's Anthropic key, passed explicitly to `createEngine({ apiKey })`. The library never reads env vars.
