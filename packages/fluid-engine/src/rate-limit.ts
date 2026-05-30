/**
 * Sliding-window in-memory rate limiter, keyed by string (typically IP).
 *
 * Phase 2-friendly stub. Phase 3 swaps for Redis/Upstash with the same shape.
 * The window is bucketed by request timestamps; old timestamps are dropped on
 * every check, so the data structure stays small in practice.
 */

interface Bucket {
  hits: number[];
}

const buckets = new Map<string, Bucket>();
const MAX_BUCKETS = 5000;

export interface RateLimitOptions {
  limit: number;
  windowMs: number;
}

export interface RateLimitResult {
  ok: boolean;
  remaining: number;
  retryAfterMs: number;
}

export function checkRateLimit(key: string, opts: RateLimitOptions): RateLimitResult {
  const now = Date.now();
  const cutoff = now - opts.windowMs;
  let bucket = buckets.get(key);
  if (!bucket) {
    bucket = { hits: [] };
    buckets.set(key, bucket);
    // Soft eviction if the map grows unbounded.
    if (buckets.size > MAX_BUCKETS) {
      const oldest = buckets.keys().next().value;
      if (oldest !== undefined && oldest !== key) buckets.delete(oldest);
    }
  }
  bucket.hits = bucket.hits.filter((t) => t > cutoff);
  if (bucket.hits.length >= opts.limit) {
    const oldest = bucket.hits[0];
    return {
      ok: false,
      remaining: 0,
      retryAfterMs: Math.max(0, oldest + opts.windowMs - now),
    };
  }
  bucket.hits.push(now);
  return { ok: true, remaining: opts.limit - bucket.hits.length, retryAfterMs: 0 };
}

export function _resetRateLimit(): void {
  buckets.clear();
}
