import { createHash } from "node:crypto";
import type { FluidIR } from "@/fluid/core";

/**
 * In-memory IR cache keyed by (schema, intent).
 *
 * Phase 2 stub. Phase 3 swaps this for Redis with TTL + per-userId keying,
 * but the interface stays the same so callers don't change.
 *
 * Hardening:
 *   - LRU bound (MAX_ENTRIES) so the cache can't grow without limit.
 *   - Single-flight dedup: concurrent gen requests for the same key share
 *     one in-flight Promise. Stampede protection for the demo and prod.
 */

interface CacheEntry {
  ir: FluidIR;
  createdAt: number;
}

const TTL_MS = 60 * 60 * 1000;
const MAX_ENTRIES = 500;

// Map preserves insertion order — re-set on read to make it act LRU.
const store = new Map<string, CacheEntry>();
const inflight = new Map<string, Promise<FluidIR>>();

export function intentKey(schemaName: string, intent: string): string {
  const normalized = intent.trim().toLowerCase().replace(/\s+/g, " ");
  const hash = createHash("sha256").update(normalized).digest("hex").slice(0, 16);
  return `ir:${schemaName}:${hash}`;
}

export function getCachedIR(key: string): FluidIR | null {
  const entry = store.get(key);
  if (!entry) return null;
  if (Date.now() - entry.createdAt > TTL_MS) {
    store.delete(key);
    return null;
  }
  // Re-set to bump LRU position.
  store.delete(key);
  store.set(key, entry);
  return entry.ir;
}

export function setCachedIR(key: string, ir: FluidIR): void {
  if (store.has(key)) store.delete(key);
  store.set(key, { ir, createdAt: Date.now() });
  // Evict oldest until under cap.
  while (store.size > MAX_ENTRIES) {
    const oldest = store.keys().next().value;
    if (oldest === undefined) break;
    store.delete(oldest);
  }
}

/**
 * Coalesce concurrent generation requests for the same key.
 * If a request is already in flight, return its promise; otherwise run the
 * factory, register it, and clean up after settle.
 */
export async function singleFlight<T extends FluidIR>(
  key: string,
  factory: () => Promise<T>,
): Promise<T> {
  const existing = inflight.get(key);
  if (existing) return existing as Promise<T>;
  const p = factory().finally(() => {
    inflight.delete(key);
  });
  inflight.set(key, p);
  return p;
}

/** Test/debug helper. */
export function _resetCache(): void {
  store.clear();
  inflight.clear();
}
