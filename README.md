# Fluid

**Dynamic UI infrastructure — "GraphQL for frontend personalization."**

Fluid generates personalized user interfaces from a single schema. Developers ship one `.fluid.ts` capability declaration; an LLM-driven engine reads it alongside user intent and produces a sandboxed JSON component tree (the **IR**). The renderer walks the IR and delivers a server-rendered React UI tailored to each user. No per-user component code. No manual customization.

```
.fluid.ts schema  →  user intent  →  IR (JSON tree)  →  SSR render  →  personalized UI
```

## The Problem

Static UIs assume you can enumerate user types. With 5 intent dimensions × 4 values, that's 1,024 archetypes. You can't hand-design 1,024 layouts. Forward-deployed engineers at Palantir, Ramp, and Scale charge $200k+ per customer to reshape UIs around how specific teams work — proving the market exists. Fluid makes it automatic and per-user instead of per-contract.

## The Solution

Three packages:

1. **`@fluid/core`** — schema definition + IR types + semantic validation. No runtime deps beyond Zod. The LLM never sees this; it's the spec the LLM is held to.
2. **`@fluid/engine`** — LLM bridge. `createEngine({ apiKey })` returns an instance that owns prompt construction, the Anthropic call, the IR cache, the rate limiter, the intent-profile store, and the retry-with-feedback loop. BYOK and adapter-pluggable.
3. **`@fluid/react`** — `FluidView` (server-safe), `fetchIR`, and `useFluidIR` (client hook).

Two generation paths:

- **`engine.generate(...)`** — stateless single-shot. Cache-warm. Anonymous traffic, server-rendered first paint, "regenerate" buttons.
- **`engine.refine(...)`** — learning path. Reads the user's `IntentProfile`, expands the prompt with recent history, writes the new intent back. This is the "Fluid learns who you are" loop.

**The IR is the IP.** Sandboxed JSON. Cannot reference undeclared fields. Cannot make unauthorized API calls. Validated by Zod before storage. The boundary between LLM output and rendered components.

## Repository layout

```
genUI/
├── packages/
│   ├── fluid-core/      → @fluid/core
│   ├── fluid-engine/    → @fluid/engine
│   └── fluid-react/     → @fluid/react
└── apps/
    └── engine/          → @fluid-app/engine (Next.js 16 showcase)
```

## Demo Use Case

A SaaS task manager where a lawyer, an engineer, and a PM open the same product and each sees a fundamentally different information architecture:

| User | Intent | Generated UI |
|---|---|---|
| **Lawyer** | "Tasks grouped by matter, snippets pinned beside them" | Split-panel — grouped list + pinned snippets |
| **Engineer** | "Kanban by status, compact cards, see who owns what" | Kanban — status columns, assignee badges |
| **PM** | "High-level status across projects, then drill down" | Dashboard — stat widgets, priority list |

Same schema. Same API. Same backend. Different UIs.

## Architecture at a glance

```
┌─────────────────────────────────────────────────────────────────┐
│                  Consumer's Next.js process                     │
│                                                                  │
│   .fluid.ts schema                                              │
│         │                                                        │
│         ▼                                                        │
│   getEngine() ──▶ createEngine({                                │
│                       apiKey,                                   │
│                       cache?,        ← CacheAdapter             │
│                       rateLimiter?,  ← RateLimiter              │
│                       provider?      ← LLMProvider              │
│                   })                                            │
│         │                                                        │
│         ▼                                                        │
│   /api/generate ──▶ engine.generate({ schema, intent, userId })│
│                          │                                       │
│                          ▼                                       │
│                  Anthropic (consumer's API key)                 │
│                          │                                       │
│                          ▼                                       │
│                  Validated IR ──▶ JSON response                 │
│                                                                  │
│   <FluidView ir data />                                         │
│   useFluidIR({ endpoint, intent, userId })                      │
└─────────────────────────────────────────────────────────────────┘
```

See [ARCHITECTURE.md](./ARCHITECTURE.md) for layer-by-layer detail, the full LLM flow, caching strategy, and security model.

## Project Status

### Phase 1 — IR Spec + Renderer

Three hardcoded archetype IRs prove the loop. Same data → three radically different UIs. Lives in `apps/engine`.

### Phase 2 — LLM Bridge

Live generation from freeform intent strings.

- Provider-agnostic `LLMProvider` interface; default `AnthropicProvider` (Opus 4.7 + adaptive thinking + `xhigh` effort)
- System prompt builder with `cache_control` breakpoint between the stable schema chunk and the volatile intent
- IR cache: SHA256-keyed, LRU + TTL bounded, single-flight dedup
- Two-attempt retry loop with tagged errors (`schema-violation` / `invalid-json` / `invalid-ir`)
- Rate limiter, AbortController plumbing, structured telemetry

### Workspace restructure

Phase 2 code reorganized into three publishable packages. Engine became BYOK + adapter-based — no env reads inside the library, no DB owned by the library. The showcase app now consumes Fluid as a library; a third-party consumer integrates the same way.

### Learn loop (current)

`engine.refine` + `ProfileStore` are in. The showcase app exposes a "Remember my preferences" toggle that persists a stable `userId` in localStorage and posts `learn: true`; the API surface returns the updated `IntentProfile` so the UI can render "what Fluid remembers about you." Default `ProfileStore` is in-memory; swap for Redis/Postgres via the adapter interface. See [ARCHITECTURE.md § The learn loop](./ARCHITECTURE.md#the-learn-loop--enginerefine-and-profilestore) for the prompt-expansion strategy, cache-key implications, and server-load tradeoffs.

### Phase 3 — Consumer demo app (queued)

A separate Next.js app outside this workspace that depends on the published Fluid packages, demonstrating end-to-end developer integration (define schema, wire `createEngine`, call `useFluidIR` from a client component, render with `FluidView`).

## Using Fluid in a Next.js app

### 1. Install

In a Bun workspace consuming this repo as a workspace dependency:

```json
{
  "dependencies": {
    "@fluid/core": "workspace:*",
    "@fluid/engine": "workspace:*",
    "@fluid/react": "workspace:*"
  }
}
```

(Once published, plain semver versions will work the same way.)

### 2. Define a schema

```ts
// src/schemas/tasks.fluid.ts
import { defineSchema } from "@fluid/core";

export const taskSchema = defineSchema({
  name: "tasks",
  entities: {
    Task: {
      fields: {
        id: { type: "string" },
        title: { type: "string" },
        status: { type: "string", values: ["todo", "doing", "done"] },
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
      fetch: async () => MOCK_TASKS, // or your real DB query
    },
  },
});
```

### 3. Wire the engine on the server

```ts
// src/lib/engine.ts
import "server-only";
import { createEngine, type FluidEngine } from "@fluid/engine";

let cached: FluidEngine | null = null;
export function getEngine(): FluidEngine {
  if (cached) return cached;
  cached = createEngine({ apiKey: process.env.ANTHROPIC_API_KEY! });
  return cached;
}
```

```ts
// src/app/api/generate/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getEngine } from "@/lib/engine";
import { taskSchema } from "@/schemas/tasks.fluid";

export async function POST(req: NextRequest) {
  const { intent, userId, learn } = await req.json();
  const engine = getEngine();

  const ip = req.headers.get("x-forwarded-for") ?? "anon";
  const rl = await engine.checkRateLimit(`gen:${ip}`);
  if (!rl.ok) return NextResponse.json({ error: "rate-limited" }, { status: 429 });

  // learn=true → engine.refine: reads + writes the user's IntentProfile,
  // expands the prompt with recent history, returns the updated profile.
  // learn=false → engine.generate: stateless, cache-warm.
  const result = learn
    ? await engine.refine({ schema: taskSchema, intent, userId })
    : await engine.generate({ schema: taskSchema, intent, userId });

  return NextResponse.json(result);
}
```

### 4. Render on the client

```tsx
"use client";
import { FluidView, useFluidIR, type DataContext } from "@fluid/react";

export function MyView({ data, intent, userId }: { data: DataContext; intent: string; userId?: string }) {
  const { ir, loading, error, refetch } = useFluidIR({
    endpoint: "/api/generate",
    intent,
    userId,
  });
  if (loading) return <Spinner />;
  if (error || !ir) return <button onClick={() => refetch()}>Retry</button>;
  return <FluidView ir={ir} data={data} />;
}
```

For SSR with a pre-baked archetype IR, render `<FluidView>` directly from a server component — no fetch needed.

### Swapping the in-memory defaults

```ts
import {
  createEngine,
  type CacheAdapter,
  type ProfileStore,
} from "@fluid/engine";

const redisCache: CacheAdapter = {
  async get(key)            { /* SELECT … */ },
  async set(key, ir)        { /* UPSERT … */ },
  async singleFlight(key, fn) { /* SET NX or in-process map */ return fn(); },
};

const pgProfileStore: ProfileStore = {
  async get(userId)              { /* SELECT intent_profile WHERE user_id = $1 */ },
  async set(userId, profile)     { /* INSERT … ON CONFLICT DO UPDATE */ },
  async delete(userId)           { /* DELETE FROM intent_profile WHERE user_id = $1 */ },
};

export const engine = createEngine({
  apiKey: process.env.ANTHROPIC_API_KEY!,
  cache: redisCache,
  profileStore: pgProfileStore,
});
```

Same shape for `RateLimiter`. A custom `provider: LLMProvider` slot exists for OpenAI/Gemini. Fluid never owns the database — the consumer's stack does.

## Running the showcase app

**Prerequisites:**
- Bun 1.0+
- Anthropic API key

```bash
bun install
export ANTHROPIC_API_KEY=sk-ant-...
bun run dev        # next dev on apps/engine
bun run smoke      # validates the three archetype IRs against the schema
bun run build      # next build
```

Open [http://localhost:3000](http://localhost:3000).

## Demo Flow

1. **Preset archetypes** — Click **Lawyer**, **Engineer**, or **PM** in the header. Same data reflows into three distinct layouts.
2. **Schema inspection** — Open `apps/engine/src/schemas/tasks.fluid.ts` to see the single source of truth.
3. **IR inspection** — Open `apps/engine/src/archetypes/lawyer.ir.ts` to see the JSON tree.
4. **Live generation** — Scroll to "Generate from intent". Type a freeform workflow description. Claude Opus 4.7 generates a fresh IR from the same schema and data.
5. **Usage metrics** — After generation, see token counts, cache hits, and latency. Toggle "show IR" to inspect the JSON.

**The wow moment:** Toggle between archetypes. Same schema, same data, radically different UIs.

**The defense:** One schema file. One API. Variants are emergent.

## Key Concepts

### The IR (Intermediate Representation)

Sandboxed JSON component tree. Cannot reference undeclared fields. Cannot make unauthorized API calls. Validated by Zod, then re-checked against the schema before render.

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
    "left":  { "type": "list", "entity": "Task",    "groupBy": "matter" },
    "right": { "type": "list", "entity": "Snippet", "filter": { "field": "pinned", "op": "eq", "value": true } }
  }
}
```

### BYOK + adapters

The library never reads env vars. The consumer passes the Anthropic API key explicitly to `createEngine`, and the LLM call runs inside the consumer's server process — so consumer costs and consumer rate limits, not Fluid's. In-memory cache, rate limiter, and profile store ship as defaults; swap for Redis/Postgres/Upstash via the published interfaces. Fluid never owns a database.

### The learn loop in one paragraph

`engine.refine({ userId, intent })` loads the user's `IntentProfile` (a bounded list of past intents), builds an "expanded intent" string that lists prior preferences with the new intent at the bottom marked as priority, hands that to the standard IR generation path, then writes the new intent into the history. The merge is prompt-side, not LLM-side — one round trip, deterministic cache key. History is capped (default 10) so prompts stay bounded. The IR cache key reflects the full expanded intent, so refine almost always pays a full LLM call; this is the explicit cost of personalization, mitigated by Anthropic's prompt cache covering the (much larger) schema prefix.

### Prompt caching

Stable content (IR grammar + schema) sits before the `cache_control` breakpoint. Volatile intent goes in the user message. 5-minute ephemeral cache. Verified at runtime via `usage.cache_read_input_tokens`.

### Provider abstraction

`LLMProvider` is an interface. Anthropic is the default. Implement the interface and pass via `createEngine({ provider })` to swap.

## Open Risks

- **Cold start** — first-time user may get a "wrong" UI. Mitigation: ship preset archetypes from community data.
- **Debugging** — when generated UI breaks, whose fault? Mitigation: log `userId + IR version + schema version` on every render.
- **Accessibility** — generated UIs risk inconsistent tab order, contrast, screen reader behavior. Mitigation: design system constraints in `.fluid.ts`.
- **Security** — hallucinated IR could expose undeclared fields. Mitigation: Zod sandbox + semantic check + rate-limit generation.
- **Polish** — Linear/Notion polish comes from hundreds of designer micro-decisions. Mitigation: position as "good enough + personalized > perfect + generic."

## Technical Decisions

### Why Anthropic Claude Opus 4.7?

- **Adaptive thinking**: Deep reasoning for structure-to-structure mapping
- **Prompt caching**: 5-min ephemeral cache reduces cost on repeat intents
- **Streaming**: Avoids HTTP timeout surprises at scale
- **16K max tokens**: Sufficient for complex IRs

### Why not structured outputs?

Recursive schemas unsupported. JSON parsing + Zod validation gives the same safety with a clean retry loop on errors.

### Why no built-in database?

A library that owns a database is a service. Keeping persistence behind the `CacheAdapter` / `RateLimiter` interfaces (and a future `ProfileStore`) means consumers run Fluid inside whatever stack they already have — Postgres, Redis, Upstash, in-memory for dev — without forking or hosting.

### Why Zod?

Runtime validation is the security boundary. TypeScript types don't exist at runtime. Zod schemas do.

## Contributing

This is a hackathon project. Not open for contributions yet.

## License

MIT
