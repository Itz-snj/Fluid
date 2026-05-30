import type { FluidIR } from "@fluid/core";

/**
 * Backing-store interfaces.
 *
 * The engine owns the IR generation logic, not the storage. Consumers plug in
 * their own implementations — Redis, Postgres, Upstash, whatever — by passing
 * objects matching these shapes to createEngine().
 *
 * The library ships in-memory defaults so the demo path works with zero setup.
 */

export interface CacheAdapter {
  get(key: string): Promise<FluidIR | null> | FluidIR | null;
  set(key: string, ir: FluidIR): Promise<void> | void;
  /** Optional: coalesce concurrent gen requests for the same key. */
  singleFlight?<T extends FluidIR>(
    key: string,
    factory: () => Promise<T>,
  ): Promise<T>;
}

export interface RateLimitDecision {
  ok: boolean;
  remaining: number;
  retryAfterMs: number;
}

export interface RateLimiter {
  check(key: string): Promise<RateLimitDecision> | RateLimitDecision;
}

/**
 * One entry in a user's intent history.
 *
 * `intent` is stored as the user typed it (after trim). We DON'T store the
 * normalized form — humans reading their own history want to see what they
 * actually said.
 */
export interface IntentHistoryEntry {
  intent: string;
  /** Epoch ms. */
  at: number;
}

/**
 * The "what Fluid has learned about this user" record.
 *
 * Kept deliberately small: a bounded recency-ordered list of past intents.
 * The merge that turns history into a "consolidated preference" happens at
 * prompt-construction time (see engine.refine), not in storage — so swapping
 * the merge strategy doesn't require a data migration.
 */
export interface IntentProfile {
  userId: string;
  /** Oldest → newest. Capped (engine bounds the length on write). */
  history: IntentHistoryEntry[];
  /** Epoch ms of the last refine() write. */
  updatedAt: number;
}

export interface ProfileStore {
  get(userId: string): Promise<IntentProfile | null> | IntentProfile | null;
  set(userId: string, profile: IntentProfile): Promise<void> | void;
  /** Optional — useful for "forget me" flows. */
  delete?(userId: string): Promise<void> | void;
}
