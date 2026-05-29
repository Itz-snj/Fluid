# Fluid Architecture

Detailed system architecture, flow diagrams, and operational guide.

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
                                       │      <FluidView ir data />   │
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
│ IntentBox UI │
└──────┬───────┘
       │ POST { intent }
       ▼
┌─────────────────────────────┐
│  /api/generate (route.ts)   │
│                             │
│  • Validate intent input    │
│  • Call generateIR()        │
└──────┬──────────────────────┘
       │
       ▼
┌─────────────────────────────┐
│  generate.ts (orchestrator) │
│                             │
│  1. Build cache key         │
│     ir:{schema}:{sha256}    │
└──────┬──────────────────────┘
       │
       ▼
┌─────────────────────────────┐         ┌──────────────────┐
│       cache.ts              │  HIT    │ Return cached IR │
│   In-memory Map (1h TTL)    │────────▶│ cached: true     │
└──────┬──────────────────────┘         └──────────────────┘
       │ MISS
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
│   provider.ts interface     │
│   getProvider() → Anthropic │
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
│  })                                             │
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
┌─────────────────────────────┐
│   generate.ts (continued)   │
│                             │
│   2. Strip ```json fences   │
│   3. JSON.parse()           │
│   4. Zod validate           │
└──────┬──────────────────────┘
       │
       ├─── FAIL ──▶ Retry once with error feedback
       │
       │ SUCCESS
       ▼
┌─────────────────────────────┐
│   cache.ts                  │
│   Store IR with 1h TTL      │
└──────┬──────────────────────┘
       │
       ▼
┌─────────────────────────────┐
│   API Response              │
│   { ir, cached, usage,      │
│     latencyMs }             │
└──────┬──────────────────────┘
       │
       ▼
┌─────────────────────────────┐
│   IntentBox (client)        │
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

| Module | Responsibility | Touched by LLM? |
|---|---|---|
| `src/fluid/core/ir.ts` | IR type definitions + Zod schemas | No (defines validation) |
| `src/fluid/core/schema.ts` | Schema runtime, entity/endpoint types | No |
| `src/fluid/engine/prompt.ts` | Build system prompt from schema | No (produces LLM input) |
| `src/fluid/engine/llm/provider.ts` | Provider-agnostic interface | No |
| `src/fluid/engine/llm/anthropic.ts` | Anthropic SDK calls | Sends/receives |
| `src/fluid/engine/cache.ts` | Cache IRs by intent hash | No |
| `src/fluid/engine/generate.ts` | Orchestrate cache → LLM → validate | Receives + validates |
| `src/fluid/react/render.tsx` | Recursive IR → React | No (consumes validated IR) |
| `src/fluid/react/data.ts` | Query, group, bind data to IR nodes | No |
| `src/fluid/react/FluidView.tsx` | Public component, re-validates before render | No (defensive validation) |

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
cache.set(key, ir, 3600)
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

### Two cache layers

**1. Application IR cache** (`src/fluid/engine/cache.ts`)
- Keyed by `ir:{schema}:{sha256(intent)[:16]}`
- TTL: 1 hour
- Storage: In-memory `Map` (Phase 2), Redis (Phase 3)
- Hit avoids the LLM call entirely

**2. Anthropic prompt cache** (`cache_control: { type: "ephemeral" }`)
- Caches the system prompt prefix (grammar + schema)
- TTL: 5 minutes
- Hit reduces input token cost on cache-miss requests
- Verified via `usage.cache_read_input_tokens`

### Cache key normalization

```typescript
intent.trim().toLowerCase().replace(/\s+/g, " ")
  → sha256 → slice(0, 16)
```

Whitespace and case differences collapse to the same key. "  Show TASKS " == "show tasks".

---

## Security Model

### Sandbox guarantees

The IR is **the** security boundary. Even a fully malicious LLM cannot:

1. **Reference undeclared entities/fields** — Zod schema enforces field existence at validation time
2. **Call unauthorized endpoints** — Renderer only invokes `schema.endpoints[name].fetch()`; no arbitrary URL fetching
3. **Inject HTML/script** — Renderer maps IR nodes to React elements; no `dangerouslySetInnerHTML`
4. **Read server secrets** — Engine runs server-side; only the validated IR crosses to the client
5. **Trigger side effects** — `fetch` functions are developer-authored; LLM names them, doesn't define them

### Failure modes

| Failure | Detection | Recovery |
|---|---|---|
| Invalid JSON | `JSON.parse()` throws | Retry with error |
| Schema violation | Zod validation fails | Retry with error |
| Missing entity | Zod `refine()` fails | Retry with error |
| Generation timeout | 120s API timeout | 502 response |
| LLM unavailable | Provider throws | 502 response |

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

1. Add type to `src/fluid/core/ir.ts` (TypeScript + Zod)
2. Add render branch to `src/fluid/react/render.tsx`
3. Document in system prompt (`src/fluid/engine/prompt.ts`)

### Add a new LLM provider

1. Implement `LLMProvider` interface in `src/fluid/engine/llm/{provider}.ts`
2. Register in `src/fluid/engine/llm/index.ts` factory
3. Set `FLUID_LLM_PROVIDER` env var

### Add a new schema

1. Create `src/schemas/{name}.fluid.ts`
2. Call `defineSchema({...})`
3. Export for use in `page.tsx`

### Swap cache backend

Replace `src/fluid/engine/cache.ts` impl. Interface is `{ get, set, delete }` — Redis swap is ~10 lines.

---

## Comparison: Static UIs vs. Fluid

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
- **Engine** — The LLM bridge: prompt + provider + cache + validator.
- **Renderer** — Recursive React component tree builder from IR.
