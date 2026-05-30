import { eq, and, gt } from "drizzle-orm";
import type { CacheAdapter } from "@fluid/engine";
import type { FluidIR } from "@fluid/core";
import type { FluidDb } from "./connection";
import { generatedIrs } from "./schema";

/**
 * PostgreSQL-backed CacheAdapter.
 *
 * Stores generated IR JSON in the `fluid_generated_irs` table.
 * Cache key uniqueness is enforced by a UNIQUE index on `cache_key`.
 *
 * TTL is expressed as `expires_at`. When not set, the IR is kept forever
 * (useful for per-user IRs you want to version and keep for history).
 *
 * singleFlight is NOT implemented here — use a Redis-based adapter if you
 * need cross-process request coalescing. Within a single process, the
 * in-memory singleFlight is sufficient.
 */
export function createPgCacheAdapter(
  db: FluidDb,
  opts: { defaultTtlMs?: number } = {},
): CacheAdapter {
  const ttlMs = opts.defaultTtlMs ?? 24 * 60 * 60 * 1000; // 24h default

  return {
    async get(key: string): Promise<FluidIR | null> {
      const now = new Date();
      const rows = await db
        .select({ irJson: generatedIrs.irJson, expiresAt: generatedIrs.expiresAt })
        .from(generatedIrs)
        .where(eq(generatedIrs.cacheKey, key))
        .limit(1);

      const row = rows[0];
      if (!row) return null;

      // Respect TTL if set.
      if (row.expiresAt && row.expiresAt < now) {
        // Expired — delete async (fire and forget) and return miss.
        void db.delete(generatedIrs).where(eq(generatedIrs.cacheKey, key));
        return null;
      }

      return row.irJson as FluidIR;
    },

    async set(
      key: string,
      ir: FluidIR,
      meta?: {
        userId?: string;
        schemaName?: string;
        intentUsed?: string;
        wasRefined?: boolean;
        attempts?: number;
        latencyMs?: number;
        inputTokens?: number;
        outputTokens?: number;
      },
    ): Promise<void> {
      const expiresAt = new Date(Date.now() + ttlMs);
      const archetype =
        typeof (ir as Record<string, unknown>).archetype === "string"
          ? (ir as Record<string, unknown>).archetype as string
          : null;

      await db
        .insert(generatedIrs)
        .values({
          userId: meta?.userId ?? "anon",
          schemaName: meta?.schemaName ?? "unknown",
          cacheKey: key,
          irJson: ir as Record<string, unknown>,
          archetype,
          intentUsed: meta?.intentUsed ?? "",
          wasRefined: meta?.wasRefined ?? false,
          attempts: meta?.attempts ?? 1,
          latencyMs: meta?.latencyMs,
          inputTokens: meta?.inputTokens,
          outputTokens: meta?.outputTokens,
          expiresAt,
        })
        .onConflictDoUpdate({
          target: generatedIrs.cacheKey,
          set: {
            irJson: ir as Record<string, unknown>,
            archetype,
            expiresAt,
          },
        });
    },
  };
}
