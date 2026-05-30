import type { RateLimitDecision, RateLimiter } from "./adapters";

/**
 * Sliding-window in-memory rate limiter.
 *
 * Each instance owns its own bucket map — no module-level singletons — so
 * consumers can scope limiters per engine, per route, or per tenant. The
 * window is bucketed by request timestamps; old timestamps are evicted on
 * every check, so memory stays bounded in practice.
 *
 * For multi-instance prod, swap for a Redis/Upstash limiter — same shape.
 */

export interface MemoryRateLimitOptions {
  /** Max hits allowed per key per window. */
  limit?: number;
  /** Window size in ms. */
  windowMs?: number;
  /** Hard cap on number of buckets before soft eviction. */
  maxBuckets?: number;
}

interface Bucket {
  hits: number[];
}

export function createMemoryRateLimiter(
  opts: MemoryRateLimitOptions = {},
): RateLimiter {
  const limit = opts.limit ?? 20;
  const windowMs = opts.windowMs ?? 60_000;
  const maxBuckets = opts.maxBuckets ?? 5000;
  const buckets = new Map<string, Bucket>();

  return {
    check(key: string): RateLimitDecision {
      const now = Date.now();
      const cutoff = now - windowMs;
      let bucket = buckets.get(key);
      if (!bucket) {
        bucket = { hits: [] };
        buckets.set(key, bucket);
        if (buckets.size > maxBuckets) {
          const oldest = buckets.keys().next().value;
          if (oldest !== undefined && oldest !== key) buckets.delete(oldest);
        }
      }
      bucket.hits = bucket.hits.filter((t) => t > cutoff);
      if (bucket.hits.length >= limit) {
        const oldest = bucket.hits[0];
        return {
          ok: false,
          remaining: 0,
          retryAfterMs: Math.max(0, oldest + windowMs - now),
        };
      }
      bucket.hits.push(now);
      return { ok: true, remaining: limit - bucket.hits.length, retryAfterMs: 0 };
    },
  };
}
