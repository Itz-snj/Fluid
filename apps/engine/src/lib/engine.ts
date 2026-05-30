import "server-only";
import { createEngine, type FluidEngine } from "@fluid/engine";

/**
 * Single shared engine instance for this Next.js process.
 *
 * We lazy-construct so that bundling a route that never imports the engine
 * doesn't crash without an API key. Reuse matters: the engine's cache and
 * rate limiter are stateful — building one per request would defeat both.
 */
let cached: FluidEngine | null = null;

export function getEngine(): FluidEngine {
  if (cached) return cached;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error(
      "ANTHROPIC_API_KEY is not set. Add it to .env.local before calling getEngine().",
    );
  }
  cached = createEngine({ apiKey });
  return cached;
}
