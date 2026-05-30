import { createHash } from "node:crypto";
import type { FluidIR } from "@fluid/core";
import type { CacheAdapter } from "./adapters";

/**
 * Stable cache key for an (schema, intent[, userId]) tuple.
 *
 * Intent is normalized (trim, lowercase, collapse whitespace) before hashing
 * so trivially different requests collapse to the same key.
 */
export function intentKey(
  schemaName: string,
  intent: string,
  userId?: string,
): string {
  const normalized = intent.trim().toLowerCase().replace(/\s+/g, " ");
  const hash = createHash("sha256").update(normalized).digest("hex").slice(0, 16);
  const ns = userId ? `:${userId}` : "";
  return `ir:${schemaName}${ns}:${hash}`;
}

export interface MemoryCacheOptions {
  /** Hard cap on number of entries before LRU eviction. */
  maxEntries?: number;
  /** Entries older than this are treated as missing on read. */
  ttlMs?: number;
}

interface CacheEntry {
  ir: FluidIR;
  createdAt: number;
}

/**
 * Default in-memory CacheAdapter: LRU-bounded, TTL'd, with single-flight dedup.
 * Good for dev, demos, and single-instance prod.
 *
 * For multi-instance prod, swap this for a Redis/Upstash adapter — same shape.
 */
export function createMemoryCache(opts: MemoryCacheOptions = {}): CacheAdapter {
  const maxEntries = opts.maxEntries ?? 500;
  const ttlMs = opts.ttlMs ?? 60 * 60 * 1000;
  const store = new Map<string, CacheEntry>();
  const inflight = new Map<string, Promise<FluidIR>>();

  return {
    get(key) {
      const entry = store.get(key);
      if (!entry) return null;
      if (Date.now() - entry.createdAt > ttlMs) {
        store.delete(key);
        return null;
      }
      // Bump LRU position.
      store.delete(key);
      store.set(key, entry);
      return entry.ir;
    },

    set(key, ir) {
      if (store.has(key)) store.delete(key);
      store.set(key, { ir, createdAt: Date.now() });
      while (store.size > maxEntries) {
        const oldest = store.keys().next().value;
        if (oldest === undefined) break;
        store.delete(oldest);
      }
    },

    singleFlight<T extends FluidIR>(key: string, factory: () => Promise<T>): Promise<T> {
      const existing = inflight.get(key);
      if (existing) return existing as Promise<T>;
      const p = factory().finally(() => inflight.delete(key));
      inflight.set(key, p);
      return p;
    },
  };
}
