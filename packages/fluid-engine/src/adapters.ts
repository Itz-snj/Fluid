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
