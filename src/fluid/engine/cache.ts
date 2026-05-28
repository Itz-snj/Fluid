import { createHash } from "node:crypto";
import type { FluidIR } from "@/fluid/core";

/**
 * In-memory IR cache keyed by (schema, intent).
 *
 * Phase 2 stub. Phase 3 swaps this for Redis with TTL + per-userId keying,
 * but the interface stays the same so callers don't change.
 *
 * Why cache: generation is the expensive op (~$0.01 + a few seconds of latency).
 * The renderer is cheap. The whole architectural bet is "expensive once, cheap forever."
 */

interface CacheEntry {
  ir: FluidIR;
  createdAt: number;
}

const store = new Map<string, CacheEntry>();
const TTL_MS = 60 * 60 * 1000;

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
  return entry.ir;
}

export function setCachedIR(key: string, ir: FluidIR): void {
  store.set(key, { ir, createdAt: Date.now() });
}
