import type { FluidSchema } from "@fluid/core";
import type {
  CacheAdapter,
  IntentProfile,
  ProfileStore,
  RateLimiter,
  RateLimitDecision,
} from "./adapters";
import type { LLMProvider } from "./llm";
import { createAnthropicProvider } from "./llm";
import { createMemoryCache } from "./cache";
import { createMemoryProfileStore } from "./profile";
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
  /** IR cache adapter. Defaults to an in-memory LRU+TTL cache. */
  cache?: CacheAdapter;
  /** Rate limiter. Defaults to an in-memory sliding-window limiter. */
  rateLimiter?: RateLimiter;
  /** Intent-profile store. Defaults to an in-memory store (dies on restart). */
  profileStore?: ProfileStore;
  /** How many recent intents to retain per user. Default 10. */
  maxHistoryPerUser?: number;
}

export interface EngineGenerateOptions extends Omit<GenerateIROptions, "schema"> {
  schema: FluidSchema;
}

export interface EngineRefineOptions {
  schema: FluidSchema;
  /** Required for refine — the whole point is learning per user. */
  userId: string;
  intent: string;
  bypassCache?: boolean;
  signal?: AbortSignal;
}

export interface EngineRefineResult extends GenerateIRResult {
  /** The user's profile AFTER this refine call (history includes the new intent). */
  profile: IntentProfile;
}

export interface FluidEngine {
  /**
   * One-shot: generate IR from an intent. Stateless — does not read or write
   * profile history. Use this for anonymous traffic or "regenerate without
   * memory" paths.
   */
  generate(opts: EngineGenerateOptions): Promise<GenerateIRResult>;

  /**
   * Learning path. Loads the user's intent profile, builds an "expanded intent"
   * that includes recent history, runs generate(), and writes the new intent
   * to the profile. The cache key reflects the full expanded intent — so two
   * users with different histories typing the same new intent get different
   * UIs.
   */
  refine(opts: EngineRefineOptions): Promise<EngineRefineResult>;

  checkRateLimit(key: string): Promise<RateLimitDecision> | RateLimitDecision;

  readonly cache: CacheAdapter;
  readonly rateLimiter: RateLimiter;
  readonly profileStore: ProfileStore;
  readonly provider: LLMProvider;
}

/**
 * The single entry point for consumers.
 *
 * Server-side use: import { createEngine } from "@fluid/engine" inside a Next
 * route / server action. Pass your Anthropic key from process.env. Reuse the
 * returned engine across requests — its cache, rate limiter, and profile
 * store are stateful.
 *
 *     const engine = createEngine({ apiKey: process.env.ANTHROPIC_API_KEY! });
 *     const { ir }            = await engine.generate({ schema, intent });
 *     const { ir, profile }   = await engine.refine({ schema, userId, intent });
 *
 * For multi-instance prod, swap the default in-memory adapters by passing
 * `cache`, `rateLimiter`, and `profileStore` implementations.
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
  const profileStore = opts.profileStore ?? createMemoryProfileStore();
  const maxHistory = Math.max(1, opts.maxHistoryPerUser ?? 10);

  return {
    provider,
    cache,
    rateLimiter,
    profileStore,

    generate(genOpts) {
      return generateIR(genOpts, { provider, cache });
    },

    checkRateLimit(key) {
      return rateLimiter.check(key);
    },

    async refine(refineOpts) {
      const { schema, userId, intent, bypassCache, signal } = refineOpts;
      const existing = (await profileStore.get(userId)) ?? {
        userId,
        history: [],
        updatedAt: 0,
      };

      const expandedIntent = buildExpandedIntent(existing.history, intent);

      const result = await generateIR(
        {
          schema,
          intent: expandedIntent,
          userId,
          bypassCache,
          signal,
        },
        { provider, cache },
      );

      const nextHistory = [
        ...existing.history,
        { intent: intent.trim(), at: Date.now() },
      ].slice(-maxHistory);
      const nextProfile: IntentProfile = {
        userId,
        history: nextHistory,
        updatedAt: Date.now(),
      };
      await profileStore.set(userId, nextProfile);

      return { ...result, profile: nextProfile };
    },
  };
}

/**
 * Turns (history, new intent) into the string we hand to the LLM as `intent`.
 *
 * Why this shape rather than a separate "merge with an LLM" step:
 *   - One LLM call instead of two — half the cost, half the latency.
 *   - The cache key derives from this string, so identical (history, new) pairs
 *     hit the cache. A separate LLM merge would emit non-deterministic prose
 *     and bust the cache on every call.
 *   - The model already sees the schema; layering recent preferences into the
 *     user message is enough to get personalized output.
 *
 * The format is deliberately terse so it doesn't bloat the input prompt for
 * users with long histories.
 */
function buildExpandedIntent(
  history: IntentProfile["history"],
  newIntent: string,
): string {
  const trimmed = newIntent.trim();
  if (history.length === 0) return trimmed;

  const lines = history.map((h, i) => `  ${i + 1}. ${h.intent}`).join("\n");
  return [
    "Prior preferences for this user (oldest → newest):",
    lines,
    "",
    `Current intent (takes priority): ${trimmed}`,
  ].join("\n");
}
