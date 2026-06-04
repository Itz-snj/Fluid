import "server-only";
import {
  createEngine,
  createGroqProvider,
  type FluidEngine,
} from "@fluid-genui/engine";
import { createContextEnricher, createRefreshPolicy } from "@fluid-genui/telemetry";
import {
  createDbConnection,
  createPgProfileStore,
  createPgCacheAdapter,
  createPgUsageTracker,
  type FluidDb,
} from "@fluid-genui/db";

/**
 * Single shared engine instance for this Next.js process.
 * Uses Groq for ultra-fast free inference.
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

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    throw new Error(
      "GROQ_API_KEY is not set. Get a free key at https://console.groq.com and add it to .env.local.",
    );
  }

  const model = process.env.GROQ_MODEL || "meta-llama/llama-4-scout-17b-16e-instruct";
  const provider = createGroqProvider(apiKey, model);
  console.log(`[fluid] Using Groq → ${model}`);

  const dbUrl = process.env.DATABASE_URL;

  if (dbUrl) {
    const db = getDb();
    cachedEngine = createEngine({
      provider,
      cache: createPgCacheAdapter(db),
      profileStore: createPgProfileStore(db),
      usageTracker: createPgUsageTracker(db),
      contextEnricher: createContextEnricher(),
      refreshPolicy: createRefreshPolicy(),
    });
  } else {
    console.warn(
      "[fluid] DATABASE_URL not set — using in-memory adapters.",
    );
    cachedEngine = createEngine({
      provider,
      contextEnricher: createContextEnricher(),
      refreshPolicy: createRefreshPolicy(),
    });
  }

  return cachedEngine;
}
