import postgres from "postgres";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error("❌ DATABASE_URL not set");
  process.exit(1);
}

async function testConnection() {
  const client = postgres(connectionString, { max: 1 });

  try {
    console.log("🔌 Testing database connection...");

    // Test basic connection
    const result = await client`SELECT NOW()`;
    console.log("✅ Connection successful!");
    console.log("   Server time:", result[0].now);

    // Check if tables exist
    const tables = await client`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_name LIKE 'fluid_%'
      ORDER BY table_name
    `;

    console.log("\n📋 Fluid tables found:");
    if (tables.length === 0) {
      console.log("   ⚠️  No fluid tables found!");
    } else {
      tables.forEach((t: any) => console.log(`   ✓ ${t.table_name}`));
    }

    // Try to query the problematic table
    console.log("\n🔍 Testing fluid_generated_irs table...");
    const count = await client`SELECT COUNT(*) as count FROM fluid_generated_irs`;
    console.log(`   ✅ Table accessible, ${count[0].count} rows`);

  } catch (error: any) {
    console.error("❌ Error:", error.message);
    console.error("   Code:", error.code);
  } finally {
    await client.end();
  }
}

testConnection();
