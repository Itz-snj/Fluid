# Fluid

**Dynamic UI infrastructure — "GraphQL for frontend personalization."**

Fluid generates personalized user interfaces from a single schema. Developers ship one `.fluid.ts` capability declaration; an LLM-driven engine reads it alongside user intent and produces a sandboxed JSON component tree (the **IR**). The renderer walks the IR and delivers a server-rendered React UI tailored to each user. No per-user component code. No manual customization.

```
.fluid.ts schema  →  user intent  →  IR (JSON tree)  →  SSR render  →  personalized UI
```

## The Problem

Static UIs assume you can enumerate user types. With 5 intent dimensions × 4 values, that's 1,024 archetypes. You can't hand-design 1,024 layouts. Forward-deployed engineers at Palantir, Ramp, and Scale charge $200k+ per customer to reshape UIs around how specific teams work — proving the market exists. Fluid makes it automatic and per-user instead of per-contract.

## The Solution

Three layers:

1. **Schema** — developer-authored capability declaration (entities, fields, endpoints). No JSX, no CSS.
2. **Engine** — Fluid-owned. LLM emits IR, Zod validates, cache stores per `userId`.
3. **Renderer** — pulls IR from cache, binds live data, ships HTML.

**The IR is the IP.** Sandboxed JSON. Cannot reference undeclared fields. Cannot make unauthorized API calls. Validated by Zod before storage. The boundary between LLM output and rendered components.

## Demo Use Case

A SaaS task manager where a lawyer, an engineer, and a PM open the same product and each sees a fundamentally different information architecture:

| User | Intent | Generated UI |
|---|---|---|
| **Lawyer** | "Tasks grouped by matter, snippets pinned beside them" | Split-panel — grouped list + pinned snippets |
| **Engineer** | "Kanban by status, compact cards, see who owns what" | Kanban — status columns, assignee badges |
| **PM** | "High-level status across projects, then drill down" | Dashboard — stat widgets, priority list |

Same schema. Same API. Same backend. Different UIs.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         Developer Layer                          │
│  .fluid.ts schema (entities, fields, endpoints, mock data)      │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                         Engine Layer                             │
│                                                                  │
│  User Intent  →  Cache Check  →  LLM Provider (Anthropic)       │
│                       ↓                    ↓                     │
│                  Cache Hit            System Prompt              │
│                       ↓               (cached, stable)           │
│                  Return IR                  +                    │
│                                        User Message              │
│                                       (intent, volatile)         │
│                                             ↓                    │
│                                    Claude Opus 4.7               │
│                                    (adaptive thinking)           │
│                                             ↓                    │
│                                    JSON Response                 │
│                                             ↓                    │
│                                    Strip Code Fences             │
│                                             ↓                    │
│                                    JSON.parse()                  │
│                                             ↓                    │
│                                    Zod Validate                  │
│                                             ↓                    │
│                                    Cache Store (1h TTL)          │
│                                             ↓                    │
│                                    Return IR                     │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                        Renderer Layer                            │
│                                                                  │
│  FluidView  →  Recursive Render  →  Bind Data  →  SSR HTML      │
│                                                                  │
│  IR Node Types: Stack, Split, Grid, Kanban, List, Card,         │
│                 Stat, Heading, Field, Badge                      │
└─────────────────────────────────────────────────────────────────┘
```

## Project Status

### ✅ Phase 1 — IR Spec + Renderer (Complete)

Proved the core loop with three hardcoded IRs. Same data → three radically different UIs.

**Shipped:**
- IR type system with recursive node structures (`src/fluid/core/ir.ts`)
- Schema definition runtime (`src/fluid/core/schema.ts`)
- Recursive renderer with Tailwind primitives (`src/fluid/react/render.tsx`)
- Task + Snippet schema with mock data (`src/schemas/tasks.fluid.ts`)
- Three archetype IRs: lawyer (split-panel), engineer (kanban), PM (dashboard)
- Demo page with archetype switcher (`src/app/page.tsx`)

### ✅ Phase 2 — LLM Bridge (Complete)

Replaced hardcoded IRs with live generation from freeform intent strings.

**Shipped:**
- Provider-agnostic LLM interface (`src/fluid/engine/llm/provider.ts`)
- Anthropic SDK implementation with Opus 4.7, adaptive thinking, prompt caching (`src/fluid/engine/llm/anthropic.ts`)
- System prompt builder teaching IR grammar from schema (`src/fluid/engine/prompt.ts`)
- In-memory cache with SHA256-based keys, 1h TTL (`src/fluid/engine/cache.ts`)
- Generation orchestrator with retry logic (`src/fluid/engine/generate.ts`)
- POST `/api/generate` endpoint with 120s timeout (`src/app/api/generate/route.ts`)
- IntentBox UI component with suggestions, usage display, IR toggle (`src/components/IntentBox.tsx`)

**Key Decisions:**
- **Adaptive thinking + `xhigh` effort**: IR generation is structure-to-structure mapping; recommended for codegen tasks
- **Streaming**: Avoids HTTP timeout surprises, scales cheaply
- **No structured outputs**: Recursive schemas unsupported; JSON parsing + Zod validation does the same job with retry loop
- **Prompt caching**: Stable grammar + schema cached with `cache_control`; volatile intent in user message
- **Provider abstraction**: Interface-based design allows future OpenAI/Gemini swap without touching engine code

### 🔜 Phase 3 — Next.js Adapter (Planned)

Production drop-in for real Next.js apps.

- `<FluidProvider>` for `userId` / intent context
- RSC-friendly cache layer with Redis
- IR versioning + rollback
- `useFluid()` for client-side action dispatch
- `fluid` CLI: scaffold, validate, extract schema from existing API routes

### 🔜 Phase 4 — Fluid Cloud (Stretch)

Hosted intent profiles, UI versioning, analytics, archetype marketplace. Network-effect data moat.

## Setup

**Prerequisites:**
- Bun 1.0+ (package manager + runtime)
- Anthropic API key

**Install:**
```bash
bun install
```

**Configure:**
```bash
export ANTHROPIC_API_KEY=sk-ant-...
```

**Run:**
```bash
bun run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Demo Flow

1. **Preset archetypes** — Click **Lawyer**, **Engineer**, or **PM** in the header. Same data reflows into three distinct layouts.
2. **Schema inspection** — Open `src/schemas/tasks.fluid.ts` to see the single source of truth.
3. **IR inspection** — Open `src/archetypes/lawyer.ir.ts` (or engineer/pm) to see the JSON tree.
4. **Live generation** — Scroll to "Generate from intent". Type a freeform workflow description (or click a suggestion chip). Claude Opus 4.7 generates a fresh IR from the same schema and data.
5. **Usage metrics** — After generation, see token counts, cache hits, and latency. Click "show IR" to inspect the JSON.

**The wow moment:** Toggle between archetypes. Same schema, same data, radically different UIs.

**The defense:** One schema file. One API. Variants are emergent.

## File Structure

```
src/
├── fluid/
│   ├── core/
│   │   ├── ir.ts              # IR type system + Zod schemas
│   │   └── schema.ts          # Schema definition runtime
│   ├── engine/
│   │   ├── llm/
│   │   │   ├── provider.ts    # Provider-agnostic interface
│   │   │   ├── anthropic.ts   # Anthropic SDK implementation
│   │   │   └── index.ts       # Provider factory
│   │   ├── prompt.ts          # System prompt builder
│   │   ├── cache.ts           # In-memory cache (Redis-ready)
│   │   └── generate.ts        # Generation orchestrator
│   └── react/
│       ├── data.ts            # Query runner, grouping, binding
│       ├── render.tsx         # Recursive renderer
│       └── FluidView.tsx      # Public component
├── schemas/
│   └── tasks.fluid.ts         # Task + Snippet schema + mock data
├── archetypes/
│   ├── lawyer.ir.ts           # Split-panel IR
│   ├── engineer.ir.ts         # Kanban IR
│   ├── pm.ir.ts               # Dashboard IR
│   └── index.ts               # Archetype registry
├── components/
│   └── IntentBox.tsx          # Intent input + live generation UI
└── app/
    ├── page.tsx               # Demo page (server component)
    ├── layout.tsx             # Root layout
    ├── globals.css            # Tailwind + dark theme
    └── api/
        └── generate/
            └── route.ts       # POST /api/generate endpoint
```

## Key Concepts

### The IR (Intermediate Representation)

Sandboxed JSON component tree. Cannot reference undeclared fields. Cannot make unauthorized API calls. Validated by Zod before storage.

**Node types:**
- **Layout**: `Stack`, `Split`, `Grid`
- **Data**: `List`, `Kanban`
- **Primitives**: `Card`, `Stat`, `Heading`, `Field`, `Badge`

**Example:**
```json
{
  "version": 1,
  "archetype": "lawyer",
  "schema": "tasks",
  "root": {
    "type": "split",
    "left": {
      "type": "list",
      "entity": "Task",
      "groupBy": "matter",
      "variant": "comfortable"
    },
    "right": {
      "type": "list",
      "entity": "Snippet",
      "filter": { "field": "pinned", "op": "eq", "value": true }
    }
  }
}
```

### The Schema

Developer-authored capability declaration. Entities, fields, endpoints. No JSX, no CSS.

**Example:**
```typescript
export const taskSchema = defineSchema({
  name: "tasks",
  entities: {
    Task: {
      fields: {
        id: { type: "string" },
        title: { type: "string" },
        status: { type: "string" },
        priority: { type: "string" },
        assignee: { type: "string" },
        matter: { type: "string" },
        dueDate: { type: "date" },
      },
    },
  },
  endpoints: {
    tasks: {
      entity: "Task",
      fetch: async () => MOCK_TASKS,
    },
  },
});
```

### Prompt Caching

Stable content (IR grammar + schema) sits before the `cache_control` breakpoint. Volatile intent goes in the user message. 5-minute ephemeral cache. Verified at runtime via `usage.cache_read_input_tokens`.

### Provider Abstraction

Interface-based design. Swap Anthropic for OpenAI/Gemini by implementing `LLMProvider`. Engine code unchanged.

## Open Risks

- **Cold start** — first-time user may get a "wrong" UI. Mitigation: ship preset archetypes from community data.
- **Debugging** — when generated UI breaks, whose fault? Mitigation: log `userId + IR version + schema version` on every render.
- **Accessibility** — generated UIs risk inconsistent tab order, contrast, screen reader behavior. Mitigation: design system constraints in `.fluid.ts`.
- **Security** — hallucinated IR could expose undeclared fields. Mitigation: Zod sandbox + rate-limit generation.
- **Polish** — Linear/Notion polish comes from hundreds of designer micro-decisions. Mitigation: position as "good enough + personalized > perfect + generic."

## Technical Decisions

### Why Anthropic Claude Opus 4.7?

- **Adaptive thinking**: Deep reasoning for structure-to-structure mapping
- **Prompt caching**: 5-min ephemeral cache reduces cost on repeat intents
- **Streaming**: Avoids HTTP timeout surprises at scale
- **16K max tokens**: Sufficient for complex IRs

### Why not structured outputs?

Recursive schemas unsupported. JSON parsing + Zod validation gives the same safety with a clean retry loop on errors.

### Why in-memory cache?

Proof-of-concept simplicity. Redis swap is a 10-line change (same interface).

### Why Zod?

Runtime validation is the security boundary. TypeScript types don't exist at runtime. Zod schemas do.

## Contributing

This is a hackathon project. Not open for contributions yet.

## License

MIT
