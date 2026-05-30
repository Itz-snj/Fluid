import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as fs from "fs";
import * as path from "path";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error("❌ DATABASE_URL environment variable is not set");
  process.exit(1);
}

async function applyMigrations() {
  const client = postgres(connectionString, { max: 1 });

  try {
    console.log("📦 Applying migrations...");

    // Read and apply migration files in order
    const migration1 = fs.readFileSync(
      path.join(__dirname, "drizzle/0000_peaceful_diamondback.sql"),
      "utf-8"
    );
    const migration2 = fs.readFileSync(
      path.join(__dirname, "drizzle/0001_fast_menace.sql"),
      "utf-8"
    );

    // Apply migrations
    await client.unsafe(migration1);
    console.log("✅ Applied migration 0000_peaceful_diamondback.sql");

    await client.unsafe(migration2);
    console.log("✅ Applied migration 0001_fast_menace.sql");

    console.log("🎉 All migrations applied successfully!");
  } catch (error: any) {
    if (error.message.includes("already exists")) {
      console.log("ℹ️  Tables already exist, skipping...");
    } else {
      console.error("❌ Error applying migrations:", error.message);
      process.exit(1);
    }
  } finally {
    await client.end();
  }
}

applyMigrations();
