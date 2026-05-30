import type { FluidSchema } from "@fluid/core";
import type {
  CacheAdapter,
  ContextEnricher,
  ContextSignals,
  IntentProfile,
  ProfileStore,
  RateLimiter,
  RateLimitDecision,
  RefreshDecision,
  RefreshPolicy,
  UsageSummary,
  UsageTracker,
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

  // ── New adapters ──────────────────────────────────────────
  /**
   * Usage telemetry store. When provided, refine() pulls a UsageSummary
   * and injects it into the expanded intent so the LLM knows which sections
   * the user actually uses. Defaults to a no-op (telemetry disabled).
   */
  usageTracker?: UsageTracker;
  /**
   * Context enricher. Converts role, device, permissions, and other signals
   * into a natural-language paragraph appended to the expanded intent.
   * A reference implementation ships in @fluid/telemetry.
   */
  contextEnricher?: ContextEnricher;
  /**
   * Refresh policy. Checked after successful generate()/refine() calls.
   * When shouldRefresh() returns true, consumers should enqueue a
   * background re-generation job. Defaults to never-refresh.
   */
  refreshPolicy?: RefreshPolicy;
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
  /**
   * Optional environmental context (role, device, permissions, user name).
   * Passed to the ContextEnricher if one is configured.
   */
  contextSignals?: ContextSignals;
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
   * Learning path. Loads the user's intent profile, pulls usage telemetry
   * (if a UsageTracker is configured), builds an "expanded intent" that
   * includes recent history + behavioural observations + context hints, runs
   * generate(), and writes the new intent to the profile.
   *
   * The cache key derives from the full expanded intent — so two users with
   * different histories typing the same new intent get different UIs.
   */
  refine(opts: EngineRefineOptions): Promise<EngineRefineResult>;

  checkRateLimit(key: string): Promise<RateLimitDecision> | RateLimitDecision;

  /**
   * Check whether the current IR for a user should be regenerated.
   * Delegates to the configured RefreshPolicy; returns never-refresh when
   * no policy is set.
   */
  checkRefresh(ctx: {
    userId: string;
    schemaName: string;
    lastGeneratedAt: number;
  }): Promise<RefreshDecision>;

  readonly cache: CacheAdapter;
  readonly rateLimiter: RateLimiter;
  readonly profileStore: ProfileStore;
  readonly provider: LLMProvider;
  readonly usageTracker: UsageTracker;
  readonly contextEnricher: ContextEnricher | undefined;
  readonly refreshPolicy: RefreshPolicy | undefined;
}

/**
 * The single entry point for consumers.
 *
 * Server-side use: import { createEngine } from "@fluid/engine" inside a Next
 * route / server action. Pass your Anthropic key from process.env. Reuse the
 * returned engine across requests — its cache, rate limiter, profile store,
 * and usage tracker are all stateful.
 *
 *     const engine = createEngine({ apiKey: process.env.ANTHROPIC_API_KEY! });
 *     const { ir }          = await engine.generate({ schema, intent });
 *     const { ir, profile } = await engine.refine({ schema, userId, intent });
 *
 * For multi-instance prod, swap in-memory adapters for DB/Redis-backed ones:
 *
 *     const engine = createEngine({
 *       apiKey:          process.env.ANTHROPIC_API_KEY!,
 *       cache:           createPgCacheAdapter(db),
 *       profileStore:    createPgProfileStore(db),
 *       usageTracker:    createPgUsageTracker(db),
 *       contextEnricher: createContextEnricher(),
 *       refreshPolicy:   createRefreshPolicy(),
 *     });
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

  // No-op UsageTracker — used when caller does not configure telemetry.
  const noopTracker: UsageTracker = {
    recordBatch: async () => {},
    summarize: async () => null,
  };
  const usageTracker = opts.usageTracker ?? noopTracker;
  const contextEnricher = opts.contextEnricher;
  const refreshPolicy = opts.refreshPolicy;

  return {
    provider,
    cache,
    rateLimiter,
    profileStore,
    usageTracker,
    contextEnricher,
    refreshPolicy,

    generate(genOpts) {
      return generateIR(genOpts, { provider, cache });
    },

    checkRateLimit(key) {
      return rateLimiter.check(key);
    },

    async checkRefresh({ userId, schemaName, lastGeneratedAt }) {
      if (!refreshPolicy) return { refresh: false };
      const summary = await usageTracker.summarize(userId, schemaName, 7);
      return refreshPolicy.shouldRefresh({ userId, lastGeneratedAt, usageSummary: summary });
    },

    async refine(refineOpts) {
      const { schema, userId, intent, bypassCache, signal, contextSignals } = refineOpts;

      // 1. Load existing profile.
      const existing = (await profileStore.get(userId)) ?? {
        userId,
        history: [],
        updatedAt: 0,
      };

      // 2. Pull usage summary (no-op when tracker is not configured).
      let usageSummary: UsageSummary | null = null;
      try {
        usageSummary = await usageTracker.summarize(userId, schema.name, 7);
      } catch {
        // Telemetry failure must never block UI generation.
      }

      // 3. Build context hint string from role/device/permissions/etc.
      let contextHints = "";
      if (contextEnricher) {
        try {
          contextHints = await contextEnricher.enrich({
            userId,
            profile: existing,
            usageSummary,
            contextSignals,
          });
        } catch {
          // Context enrichment failure must never block UI generation.
        }
      }

      // 4. Assemble the expanded intent (history + usage + context).
      const expandedIntent = buildExpandedIntent(
        existing.history,
        intent,
        usageSummary,
        contextHints,
      );

      // 5. Generate IR from the expanded intent.
      const result = await generateIR(
        { schema, intent: expandedIntent, userId, bypassCache, signal },
        { provider, cache },
      );

      // 6. Persist updated profile (append new intent, cap history).
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
 * Assembles the full intent string that goes to the LLM.
 *
 * Sections (all optional except the final "Current intent"):
 *   1. Prior preferences — bounded intent history, oldest → newest.
 *   2. Usage observations — behavioural summary from telemetry.
 *   3. Context — role, device, time-of-day, permissions, etc.
 *   4. Current intent — the user's actual request (always last, highest priority).
 *
 * Design rationale:
 *   - One LLM call instead of two — half the cost, half the latency.
 *   - The cache key derives from this string; identical inputs hit the cache.
 *   - The model already sees the schema; layering context here is enough to
 *     produce meaningfully personalised output without extra prompting.
 */
export function buildExpandedIntent(
  history: IntentProfile["history"],
  newIntent: string,
  usageSummary?: UsageSummary | null,
  contextHints?: string,
): string {
  const parts: string[] = [];

  // --- Prior text preferences ---
  if (history.length > 0) {
    const lines = history.map((h, i) => `  ${i + 1}. ${h.intent}`).join("\n");
    parts.push("Prior preferences for this user (oldest → newest):");
    parts.push(lines);
    parts.push("");
  }

  // --- Behavioural observations (only when there is enough signal) ---
  if (usageSummary && usageSummary.totalEvents >= 10) {
    const obs: string[] = [];
    if (usageSummary.hotNodeTypes.length > 0) {
      const hot = usageSummary.hotNodeTypes
        .slice(0, 5)
        .map(
          (n) =>
            `${n.type}${n.entity ? ` (${n.entity})` : ""}: ${n.count} interactions`,
        )
        .join(", ");
      obs.push(`  Most used: ${hot}`);
    }
    if (usageSummary.coldNodeTypes.length > 0) {
      const cold = usageSummary.coldNodeTypes
        .map((n) => `${n.type}${n.entity ? ` (${n.entity})` : ""}`)
        .join(", ");
      obs.push(`  Never interacted with: ${cold}`);
    }
    if (usageSummary.inferredLayout) {
      obs.push(`  Inferred layout preference: ${usageSummary.inferredLayout}`);
    }
    if (usageSummary.inferredDensity) {
      obs.push(`  Inferred density preference: ${usageSummary.inferredDensity}`);
    }
    if (obs.length > 0) {
      parts.push(`Usage observations (last ${usageSummary.windowDays} days):`);
      parts.push(obs.join("\n"));
      parts.push("");
    }
  }

  // --- Context hints (role, device, permissions, name …) ---
  if (contextHints && contextHints.trim()) {
    parts.push("Context:");
    parts.push(`  ${contextHints.trim()}`);
    parts.push("");
  }

  parts.push(`Current intent (takes priority): ${newIntent.trim()}`);
  return parts.join("\n");
}
