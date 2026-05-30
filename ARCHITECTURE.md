# Fluid Architecture

Detailed system architecture, flow diagrams, and operational guide.

> **Status:** Phase 1 + Phase 2 + Phase 3 complete. Workspace has five packages (`@fluid/core`, `@fluid/engine`, `@fluid/react`, `@fluid/db`, `@fluid/telemetry`) plus two apps (`apps/engine` showcase, `crm` demo consumer). The chatbot (conversational IR patching), telemetry-driven suggestions, snapshot versioning, Gemini provider, and DB-backed adapters are all wired.

---

## Workspace layout

```
genUIBackend/
├── packages/
│   ├── fluid-core/        → @fluid/core       IR + Schema + semantic validation
│   ├── fluid-engine/      → @fluid/engine     LLM bridge + adapters + createEngine()
│   ├── fluid-react/       → @fluid/react      FluidView + FluidChat + hooks
│   ├── fluid-db/          → @fluid/db         Drizzle schema + Postgres adapters
│   └── fluid-telemetry/   → @fluid/telemetry  Context enricher + refresh policy
├── apps/
│   └── engine/            → @fluid-app/engine  Next.js 16 showcase app
└── crm/                   → @fluid-app/crm     CRM demo consumer (10 entities)
```

- **`@fluid/core`** has no runtime dependencies beyond Zod. It defines what IR is and what makes a valid schema. The LLM never sees this code; it's the spec the LLM is held to.
- **`@fluid/engine`** is BYOK (Bring Your Own Key). It owns prompt construction, the LLM call (Anthropic or Gemini), the IR cache, the rate limiter, the retry-with-feedback loop, and conversational patching (`engine.patch`). All persistence is plugged in via adapter interfaces.
- **`@fluid/react`** has rendering + interactive components. Server-safe `FluidView`, client-side `FluidChat` (chatbot widget), `useFluidChat` (chat state + suggestions + history), `useFluidTelemetry` (usage event tracking), and `useMutations` (action dispatch).
- **`@fluid/db`** provides Drizzle ORM schema and Postgres-backed implementations of all adapters: `createPgCacheAdapter`, `createPgProfileStore`, `createPgUsageTracker`, plus chat messages, snapshots, and suggestions tables.
- **`@fluid/telemetry`** provides `createContextEnricher()` (role/device/permissions → prompt hints) and `createRefreshPolicy()` (should-we-regenerate logic).
- **`apps/engine`** wires the packages into a working Next 16 app — server route, intent box, archetype switcher, smoke script. It's both the demo and a reference integration.
- **`crm/`** is a 10-entity CRM consumer app demonstrating Fluid in a real-world scenario — with chatbot, role switching, telemetry, and live AI-generated UIs.

---

## Distribution & cost model — BYOK + adapters

Fluid is a library, not a hosted service. The consumer's Next.js (or Node) process runs the engine in its own server runtime. The consumer pays the LLM provider directly; nothing flows through Fluid-owned infrastructure.

```
┌─────────────────────────────────────────────────────────────────┐
│                Consumer's Next.js process                       │
│                                                                  │
│   getEngine()                                                   │
│     └── createEngine({ provider?, apiKey?, cache?, ... })       │
│           ├── @fluid/engine (orchestration)                     │
│           ├── LLMProvider (Anthropic or Gemini)                 │
│           ├── CacheAdapter (in-memory or Pg via @fluid/db)     │
│           ├── ProfileStore (in-memory or Pg)                    │
│           └── UsageTracker (noop or Pg)                         │
│                                                                  │
│   /api/generate  ──▶  engine.generate({ schema, intent })       │
│   /api/chat      ──▶  engine.patch({ schema, currentIR, msg })  │
│                          │                                       │
│                          ▼                                       │
│                  LLM (Anthropic or Google Gemini)               │
└─────────────────────────────────────────────────────────────────┘
```

**Why this matters:**
- No env reads inside the library. `createEngine({ apiKey })` or `createEngine({ provider })` is explicit.
- Default in-memory adapters work for dev/demos/single-instance prod with zero setup.
- Swap adapters for Postgres via `@fluid/db` — `createPgCacheAdapter(db)`, `createPgProfileStore(db)`, `createPgUsageTracker(db)`.
- **Multi-provider:** `createAnthropicProvider(key)` or `createGeminiProvider(key)`. Pass via `createEngine({ provider })`. Both implement the same `LLMProvider` interface.

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
│  5. learn === true                   │
│     ?  engine.refine({               │
│         schema, intent, userId, ...})│
│     :  engine.generate({             │
│         schema, intent, userId, ...})│
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
│   AnthropicProvider  -or-   │
│   GeminiProvider            │
└──────┬──────────────────────┘
       │
       ▼
┌─────────────────────────────────────────────────┐
│        anthropic.ts  OR  gemini.ts               │
│                                                  │
│  Anthropic: claude-opus-4-7, adaptive thinking  │
│  Gemini:    gemini-2.5-flash-preview-05-20      │
│                                                  │
│  Both implement LLMProvider.generate()          │
│  → system prompt + user message → text output   │
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
| `src/adapters.ts` | `@fluid/engine` | `CacheAdapter` / `RateLimiter` / `ProfileStore` / `UsageTracker` / `ContextEnricher` / `RefreshPolicy` interfaces | No |
| `src/engine.ts` | `@fluid/engine` | `createEngine(opts)` factory; exposes `generate()`, `refine()`, `patch()`, `checkRefresh()` | No |
| `src/prompt.ts` | `@fluid/engine` | Build system prompt from schema | No (produces LLM input) |
| `src/patch.ts` | `@fluid/engine` | `patchIR()` — conversational IR modification via LLM | Sends/receives |
| `src/patch-prompt.ts` | `@fluid/engine` | Build patch-specific system prompt (schema-aware diff instructions) | No |
| `src/llm/provider.ts` | `@fluid/engine` | Provider-agnostic `LLMProvider` interface (with `AbortSignal`) | No |
| `src/llm/anthropic.ts` | `@fluid/engine` | Anthropic SDK — Claude Opus 4.7, adaptive thinking, streaming, prompt caching | Sends/receives |
| `src/llm/gemini.ts` | `@fluid/engine` | Google Gemini SDK — Gemini 2.5 Flash, `@google/generative-ai` | Sends/receives |
| `src/cache.ts` | `@fluid/engine` | `intentKey()` + `createMemoryCache()` (LRU + TTL + single-flight) | No |
| `src/profile.ts` | `@fluid/engine` | `createMemoryProfileStore()` — per-user `IntentProfile` | No |
| `src/rate-limit.ts` | `@fluid/engine` | `createMemoryRateLimiter()` — sliding-window in-memory limiter | No |
| `src/generate.ts` | `@fluid/engine` | Orchestrate cache → LLM → parse → validate → retry | Receives + validates |
| `src/schema.ts` | `@fluid/db` | Drizzle ORM schema: `fluid_user_profiles`, `fluid_ir_cache`, `fluid_usage_events`, `fluid_snapshots`, `fluid_chat_messages`, `fluid_suggestions` | No |
| `src/profile-store.ts` | `@fluid/db` | `createPgProfileStore(db)` — Postgres-backed profile store | No |
| `src/cache-adapter.ts` | `@fluid/db` | `createPgCacheAdapter(db)` — Postgres-backed IR cache | No |
| `src/usage-tracker.ts` | `@fluid/db` | `createPgUsageTracker(db)` — Postgres usage events + summarize | No |
| `src/snapshots.ts` | `@fluid/db` | `createSnapshot()`, `getActiveSnapshot()`, `revertToSnapshot()` — IR version chain | No |
| `src/messages.ts` | `@fluid/db` | `appendMessage()`, `getMessages()` — chat history persistence | No |
| `src/suggestions.ts` | `@fluid/db` | `createSuggestion()`, `getPendingSuggestions()`, `resolveSuggestion()` | No |
| `src/context.ts` | `@fluid/telemetry` | `createContextEnricher()` — role/device/permissions → prompt hints | No |
| `src/refresh.ts` | `@fluid/telemetry` | `createRefreshPolicy()` — should-regenerate-IR logic based on usage patterns | No |
| `src/data.ts` | `@fluid/react` | `runQuery`, `groupRows`, `resolveBinding` (type-aware compare) | No |
| `src/render.tsx` | `@fluid/react` | Recursive IR → React | No (consumes validated IR) |
| `src/FluidView.tsx` | `@fluid/react` | Public component: Zod + (optional) semantic validation before render | No (defensive validation) |
| `src/FluidChat.tsx` | `@fluid/react` | Chat widget: floating bubble, message bubbles, suggestions, version history, revert | No |
| `src/useFluidChat.ts` | `@fluid/react` | Chat hook: sendMessage, revert, accept/dismiss suggestions, polls suggestions | No |
| `src/useFluidTelemetry.ts` | `@fluid/react` | Telemetry hook: batches IntersectionObserver events, posts to `/api/telemetry` | No |
| `src/useMutations.ts` | `@fluid/react` | Mutation hook: dispatches mutation actions from generated UI buttons | No |
| `src/fetchIR.ts` | `@fluid/react` | Typed fetch wrapper over the consumer's `/api/generate` | No |
| `src/useFluidIR.ts` | `@fluid/react` | Client hook: re-fetches on intent/userId change, manages AbortController | No |

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

## The learn loop — `engine.refine` and `ProfileStore`

Two generation paths now coexist in the engine:

| Method | State | When to use |
|---|---|---|
| `engine.generate({ schema, intent, userId? })` | Stateless. Reads no profile, writes no profile. | Anonymous traffic, server-rendered first paint, "regenerate" buttons, anywhere learning would be noise. |
| `engine.refine({ schema, userId, intent })` | Reads and writes the user's `IntentProfile`. | The "Fluid learns who you are" path. Requires a `userId`. |

### What an IntentProfile is

Deliberately small — just a bounded recency-ordered list of past intents:

```ts
interface IntentProfile {
  userId: string;
  history: { intent: string; at: number }[]; // oldest → newest, capped (default 10)
  updatedAt: number;
}
```

No "consolidated" / "summarized" form is stored. Consolidation happens at prompt-construction time, so swapping the merge strategy doesn't require a data migration.

### The refine flow

```
client → POST /api/generate { userId, intent, learn: true }
         ↓
         engine.refine({ schema, userId, intent })
           ├── 1. profileStore.get(userId)  → existing (or empty)
           │
           ├── 2. expandedIntent = buildExpandedIntent(history, intent)
           │     // a multi-line string:
           │     //   Prior preferences for this user (oldest → newest):
           │     //     1. kanban by status
           │     //     2. denser cards
           │     //   Current intent (takes priority): show overdue first
           │
           ├── 3. generateIR({ intent: expandedIntent, userId, ... })
           │      ↳ key = ir:{schema}:{userId}:sha256(expandedIntent)[:16]
           │      ↳ cache MISS almost always (key changes when history grows)
           │      ↳ provider call, Zod + semantic check, retry once on failure
           │
           ├── 4. nextHistory = [...history, { intent, at: Date.now() }].slice(-N)
           │
           ├── 5. profileStore.set(userId, { userId, history: nextHistory, updatedAt: ... })
           │
           └── return { ir, profile: nextProfile, cached, usage, attempts, latencyMs }
```

### Why prompt-side merge rather than a second LLM call

We could have used Claude to consolidate `(history, new intent) → coherent summary` and then generated IR from the summary. The current design rejects that:

- **Cost.** Two LLM calls per refine, not one.
- **Latency.** Doubles user-perceived wait.
- **Cache thrash.** A separate merge would emit non-deterministic prose, so the IR cache would never hit. Putting history straight into the prompt makes the cache key deterministic in `(userId, history, intent)`.

The model already has the schema; layering recent preferences into the user message is enough to bias the output.

### Cache key behavior on the refine path

Important and counterintuitive: **refine almost always MISSes the IR cache.** Each new intent grows the history, which changes the expanded intent string, which changes the hash. Concretely, for `userId = u_abc`:

| # | New intent | History before this call | Cache key changes vs. previous |
|---|---|---|---|
| 1 | "kanban" | `[]` | first ever — MISS |
| 2 | "denser cards" | `["kanban"]` | new — MISS |
| 3 | "denser cards" | `["kanban", "denser cards"]` | history grew → new key → MISS |
| 4 | "denser cards" | `["kanban", "denser cards", "denser cards"]` | history grew again → MISS |

The stateless `generate` path is still cache-warm — repeat `(schema, intent)` always hits. Refine pays a full Anthropic call per submission. That's the cost of learning. Mitigations: Anthropic's prompt cache still covers the schema prefix for 5 min (cheap input tokens), history is bounded so prompts don't blow up, and `learn` is per-request so consumers opt in.

### Where the profile actually lives

Same adapter story as the IR cache and rate limiter:

| Default | Notes |
|---|---|
| `createMemoryProfileStore({ maxUsers })` | In-process `Map`. Dies on restart. Fine for dev / demo / single-instance prod. |
| `ProfileStore` interface | `{ get(userId), set(userId, profile), delete?(userId) }`. Implement against Postgres / Redis / Upstash / Convex. Pass to `createEngine({ profileStore })`. |

Fluid never owns the DB — same principle as `CacheAdapter`. The consumer's process holds the profile store; the consumer's stack provides the persistence.

### Server-load tradeoffs

| Cost | Generate | Refine |
|---|---|---|
| Cache adapter `get` | 1 (often HIT) | 1 (usually MISS) |
| Cache adapter `set` | 0 or 1 | 1 |
| Profile adapter `get` | 0 | 1 |
| Profile adapter `set` | 0 | 1 |
| LLM calls | 0 on HIT, 1 on MISS | ~1 per call |
| Anthropic prompt cache savings | Yes (5 min) | Yes (5 min) |

In-memory adapter ops are microseconds; the real cost is the increased LLM call rate. For a hackathon demo this is fine; for prod you tune `maxHistoryPerUser` down (3-5 is often enough) and/or accept the cost as the price of personalization.

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

Two providers ship today: `AnthropicProvider` (Claude Opus 4.7) and `GeminiProvider` (Gemini 2.5 Flash).

1. Implement `LLMProvider` from `@fluid/engine` in `packages/fluid-engine/src/llm/{name}.ts`
2. Export from `packages/fluid-engine/src/llm/index.ts`
3. Pass an instance via `createEngine({ provider: createMyProvider(key) })`

### Add a new schema (integrate Fluid into a new app)

In the consumer app:

1. Create `src/schemas/{name}.fluid.ts` with `defineSchema()` from `@fluid/core`
2. Create `src/lib/engine.ts` — lazy `getEngine()` singleton calling `createEngine({ provider, cache, ... })`
3. Create API routes: `/api/generate` (intent → IR), `/api/chat` (patch IR), `/api/telemetry` (usage events)
4. Render with `<FluidView ir={ir} data={data} schema={schema} />`
5. Add `<FluidChat currentIR={ir} onIRChange={...} />` for chatbot

See `crm/` for a complete 10-entity example.

### Swap to Postgres-backed adapters

Use `@fluid/db`:

```ts
import { createDbConnection, createPgCacheAdapter, createPgProfileStore, createPgUsageTracker } from "@fluid/db";
const db = createDbConnection(process.env.DATABASE_URL!);
createEngine({
  provider: createGeminiProvider(key),
  cache: createPgCacheAdapter(db),
  profileStore: createPgProfileStore(db),
  usageTracker: createPgUsageTracker(db),
});
```

Run `drizzle-kit push` to create the tables. Schema is in `packages/fluid-db/src/schema.ts`.

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

**Fluid provides optional Postgres adapters via `@fluid/db`.** The consumer brings their own Postgres (Neon, Supabase, local). All tables are Fluid-namespaced (`fluid_*`) and don't collide with app tables.

| What | Where it lives | Package | Notes |
|---|---|---|---|
| App data (Tasks, Deals, etc.) | Consumer's own DB, exposed via `endpoint.fetch()` | `@fluid/core` | Fluid never touches this |
| Generated IRs (cache) | `fluid_ir_cache` table or in-memory | `@fluid/db` | `createPgCacheAdapter(db)` |
| Intent profiles per user | `fluid_user_profiles` table or in-memory | `@fluid/db` | `createPgProfileStore(db)` |
| Usage telemetry events | `fluid_usage_events` table or noop | `@fluid/db` | `createPgUsageTracker(db)` |
| IR snapshots (version chain) | `fluid_snapshots` table | `@fluid/db` | `createSnapshot()`, `revertToSnapshot()` |
| Chat messages | `fluid_chat_messages` table | `@fluid/db` | `appendMessage()`, `getMessages()` |
| AI suggestions | `fluid_suggestions` table | `@fluid/db` | `createSuggestion()`, `resolveSuggestion()` |
| Rate-limit state | In-memory (process) | `@fluid/engine` | Swap for Redis if scaling horizontally |

### Database setup

```bash
# 1. Set DATABASE_URL in packages/fluid-db/.env or consumer's .env.local
# 2. Push schema to Postgres
cd packages/fluid-db && npx drizzle-kit push
```

All consumer apps (apps/engine, crm) share the same database and tables. The `userId` column namespaces data per user.

**Important distinction:** Fluid never owns the developer's application data. CRM deals, tasks, contacts live in the developer's DB. Fluid's tables are metadata — cache, profiles, telemetry, chat, snapshots. The `endpoint.fetch()` pattern bridges app data; `@fluid/db` bridges engine state.

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
- **Archetype** — A named preset IR (e.g., "sales_rep", "sales_manager", "support_agent") used for demos and cold-start defaults.
- **Intent** — Freeform string describing how a user wants to work.
- **Engine** — The LLM bridge: prompt + provider + cache + validator + patcher. Constructed via `createEngine()`.
- **Patch** — Conversational IR modification. `engine.patch({ currentIR, message })` sends the current IR + a change request to the LLM, which returns a modified IR or rejects the request.
- **Snapshot** — A versioned copy of an IR stored in `fluid_snapshots`. Each patch or generate creates a new snapshot. Supports revert.
- **Suggestion** — A proactive UI improvement proposed by the system based on usage telemetry. Stored in `fluid_suggestions`, displayed in FluidChat.
- **Renderer** — Recursive React component tree builder from IR.
- **FluidChat** — Client-side chat widget (`@fluid/react`). Lets users modify the IR conversationally. Shows suggestions, version history, and revert controls.
- **Adapter** — A pluggable backing store (`CacheAdapter`, `RateLimiter`, `ProfileStore`, `UsageTracker`) the consumer supplies to `createEngine`. Defaults are in-memory; `@fluid/db` provides Postgres implementations.
- **BYOK** — Bring Your Own Key. The consumer's API key (Anthropic or Gemini), passed to `createEngine({ provider })`. The library never reads env vars.
- **LLMProvider** — Provider-agnostic interface. `AnthropicProvider` (Claude Opus 4.7) and `GeminiProvider` (Gemini 2.5 Flash) ship today.
- **IntentProfile** — Per-user record holding a bounded list of past intents. Written by `engine.refine`, read on the next refine to bias the LLM.
- **Generate vs. refine vs. patch** — Three engine methods. `generate` is stateless and cache-warm. `refine` reads + writes the profile for personalization. `patch` modifies an existing IR conversationally.

---

## CRM Demo App

The `crm/` directory is a full consumer integration demonstrating all Fluid features on a 10-entity CRM schema.

### Entities

User, Account, Contact, Lead, Deal, Activity, Product, Quote, Case, Campaign

### Routes

| Route | Method | Purpose |
|---|---|---|
| `/api/generate` | POST | Intent → IR generation (with snapshot) |
| `/api/chat` | POST/GET | Chatbot: patch IR via LLM / load history |
| `/api/chat/revert` | POST | Revert to a previous snapshot |
| `/api/ir/history` | GET | Snapshot version chain |
| `/api/suggestions` | GET | Pending AI suggestions |
| `/api/suggestions/resolve` | POST | Accept or dismiss a suggestion |
| `/api/telemetry` | POST | Usage event batch recording |
| `/api/mutate` | POST | Execute schema-declared mutations |
| `/api/refresh` | POST | Background re-generation with suggestions |
| `/api/usage` | GET | Usage summary for a user |

### Architecture

```
page.tsx (server)        → fetches CRM data, strips functions from schema
  └── CrmDashboard.tsx   → "use client", hosts FluidView + FluidChat + hooks
        ├── FluidView     → renders the current IR
        ├── FluidChat     → chatbot widget (bottom-right)
        ├── useFluidTelemetry → tracks usage events
        └── useMutations  → handles mutation actions
```

### Running

```bash
# Set env vars in crm/.env.local:
# GEMINI_API_KEY=your-google-ai-studio-key
# DATABASE_URL=your-postgres-connection-string

cd crm && bun run dev  # http://localhost:3001
```
