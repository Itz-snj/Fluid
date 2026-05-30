import "server-only";
import { createEngine, type FluidEngine } from "@fluid/engine";
import { createContextEnricher, createRefreshPolicy } from "@fluid/telemetry";
import {
  createDbConnection,
  createPgProfileStore,
  createPgCacheAdapter,
  createPgUsageTracker,
  type FluidDb,
} from "@fluid/db";

/**
 * Single shared engine instance for this Next.js process.
 *
 * Uses DB-backed adapters when DATABASE_URL is set.
 * Falls back to in-memory adapters in dev when DATABASE_URL is missing,
 * with a clear warning so the developer knows what's happening.
 */
let cachedEngine: FluidEngine | null = null;
let cachedDb: FluidDb | null = null;

export function getDb(): FluidDb {
  if (cachedDb) return cachedDb;
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) throw new Error("DATABASE_URL is not set. Add it to .env.local.");
  cachedDb = createDbConnection(dbUrl);
  return cachedDb;
}

export function getEngine(): FluidEngine {
  if (cachedEngine) return cachedEngine;

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error(
      "ANTHROPIC_API_KEY is not set. Add it to .env.local before calling getEngine().",
    );
  }

  const dbUrl = process.env.DATABASE_URL;

  if (dbUrl) {
    // Production path: DB-backed adapters.
    const db = getDb();
    cachedEngine = createEngine({
      apiKey,
      cache: createPgCacheAdapter(db),
      profileStore: createPgProfileStore(db),
      usageTracker: createPgUsageTracker(db),
      contextEnricher: createContextEnricher(),
      refreshPolicy: createRefreshPolicy(),
    });
  } else {
    // Development fallback: in-memory adapters.
    console.warn(
      "[fluid] DATABASE_URL not set — using in-memory adapters. " +
        "Profiles and telemetry will be lost on restart.",
    );
    cachedEngine = createEngine({
      apiKey,
      contextEnricher: createContextEnricher(),
      refreshPolicy: createRefreshPolicy(),
    });
  }

  return cachedEngine;
}
