import type { FluidSchema } from "@fluid/core";
import type { CacheAdapter, RateLimiter, RateLimitDecision } from "./adapters";
import type { LLMProvider } from "./llm";
import { createAnthropicProvider } from "./llm";
import { createMemoryCache } from "./cache";
import { createMemoryRateLimiter } from "./rate-limit";
import {
  type GenerateIROptions,
  type GenerateIRResult,
  generateIR,
} from "./generate";

export interface CreateEngineOptions {
  /**
   * Anthropic API key. Required unless a custom `provider` is passed.
   * The library never reads env vars itself — callers own that.
   */
  apiKey?: string;
  /** Inject a custom LLM provider. Takes precedence over apiKey. */
  provider?: LLMProvider;
  /** Cache adapter. Defaults to an in-memory LRU+TTL cache. */
  cache?: CacheAdapter;
  /** Rate limiter. Defaults to an in-memory sliding-window limiter. */
  rateLimiter?: RateLimiter;
}

export interface EngineGenerateOptions extends Omit<GenerateIROptions, "schema"> {
  schema: FluidSchema;
}

export interface FluidEngine {
  generate(opts: EngineGenerateOptions): Promise<GenerateIRResult>;
  checkRateLimit(key: string): Promise<RateLimitDecision> | RateLimitDecision;
  readonly cache: CacheAdapter;
  readonly rateLimiter: RateLimiter;
  readonly provider: LLMProvider;
}

/**
 * The single entry point for consumers.
 *
 * Server-side use: import { createEngine } from "@fluid/engine" inside a Next
 * route / server action. Pass your Anthropic key from process.env. Reuse the
 * returned engine across requests — its cache and rate limiter are stateful.
 *
 *     const engine = createEngine({ apiKey: process.env.ANTHROPIC_API_KEY! });
 *     const { ir } = await engine.generate({ schema, intent });
 *
 * For multi-instance prod, swap the default in-memory adapters by passing
 * `cache` and `rateLimiter` implementations of the published interfaces.
 */
export function createEngine(opts: CreateEngineOptions): FluidEngine {
  const provider =
    opts.provider ??
    (opts.apiKey
      ? createAnthropicProvider(opts.apiKey)
      : (() => {
          throw new Error(
            "createEngine: either `provider` or `apiKey` must be supplied.",
          );
        })());

  const cache = opts.cache ?? createMemoryCache();
  const rateLimiter = opts.rateLimiter ?? createMemoryRateLimiter();

  return {
    provider,
    cache,
    rateLimiter,
    generate(genOpts) {
      return generateIR(genOpts, { provider, cache });
    },
    checkRateLimit(key) {
      return rateLimiter.check(key);
    },
  };
}
