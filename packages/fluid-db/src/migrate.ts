/**
 * Migration runner.
 *
 * Usage:
 *   DATABASE_URL=postgres://... bun run packages/fluid-db/src/migrate.ts
 *
 * Drizzle Kit generates SQL migration files in ./drizzle from the schema.
 * This script applies all pending migrations in a transaction.
 */
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { createDbConnection } from "./connection";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("ERROR: DATABASE_URL environment variable is not set.");
  process.exit(1);
}

const db = createDbConnection(url);

console.log("Running Fluid DB migrations…");
await migrate(db, { migrationsFolder: "./drizzle" });
console.log("Migrations complete.");
process.exit(0);
