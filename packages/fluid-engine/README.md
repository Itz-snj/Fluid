# @fluid/engine

The LLM bridge for [Fluid](https://github.com/). `createEngine({ apiKey })` returns an instance that owns the system prompt, the LLM call, IR validation, the cache, the rate limiter, and the intent-profile store.

**BYOK.** The library never reads env vars. The consumer passes the API key explicitly, and the LLM call runs inside the consumer's server process — so consumer costs, consumer rate limits.

## Install

```bash
npm install @fluid/engine @fluid/core
# pick whichever provider you want:
npm install @anthropic-ai/sdk            # default
# OR
npm install @google/generative-ai
# OR
npm install groq-sdk
```

The provider SDKs are declared as **optional peer dependencies** so you only install what you use.

## Quick start

```ts
// src/lib/engine.ts
import "server-only";
import { createEngine } from "@fluid/engine";

export const engine = createEngine({
  apiKey: process.env.ANTHROPIC_API_KEY!,
});
```

```ts
// src/app/api/generate/route.ts
import { NextRequest, NextResponse } from "next/server";
import { engine } from "@/lib/engine";
import { taskSchema } from "@/schemas/tasks.fluid";

export async function POST(req: NextRequest) {
  const { intent, userId } = await req.json();
  const result = await engine.generate({ schema: taskSchema, intent, userId });
  return NextResponse.json(result);
}
```

## Two generation paths

- **`engine.generate({...})`** — stateless single-shot. Cache-warm. Use for anonymous traffic, server-rendered first paint, and "regenerate" buttons.
- **`engine.refine({...})`** — learning path. Reads the user's `IntentProfile`, expands the prompt with recent history, writes the new intent back. This is the "Fluid learns who you are" loop.

## Swapping the defaults

In-memory cache, rate limiter, and profile store ship as defaults. Swap any of them via the published adapter interfaces (`CacheAdapter`, `RateLimiter`, `ProfileStore`).

```ts
createEngine({
  apiKey: process.env.ANTHROPIC_API_KEY!,
  cache: myRedisCache,
  rateLimiter: myUpstashRateLimiter,
  profileStore: myPostgresProfileStore,
  provider: createGeminiProvider({ apiKey: process.env.GEMINI_API_KEY! }),
});
```

See the [project README](https://github.com/) for the full architecture, prompt-caching strategy, and learn-loop details.

## License

MIT
