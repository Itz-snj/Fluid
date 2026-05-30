import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

/**
 * Create a Drizzle database connection.
 *
 * Call this once per process (e.g. in lib/engine.ts) and share the
 * returned instance — postgres.js maintains its own connection pool.
 */
export function createDbConnection(databaseUrl: string) {
  const client = postgres(databaseUrl);
  return drizzle(client, { schema });
}

export type FluidDb = ReturnType<typeof createDbConnection>;
