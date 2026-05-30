import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/engine";
import { getUsageSummary } from "@fluid/db";

/**
 * GET /api/usage
 *
 * Get usage analytics summary for a user.
 *
 * Query params:
 * - userId (required)
 * - schemaName (optional, defaults to "demo")
 * - days (optional, defaults to 7)
 */
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const userId = url.searchParams.get("userId");
  const schemaName = url.searchParams.get("schemaName") || "demo";
  const days = parseInt(url.searchParams.get("days") || "7", 10);

  if (!userId) {
    return NextResponse.json({ error: "userId is required" }, { status: 400 });
  }

  const db = getDb();

  try {
    const summary = await getUsageSummary(db, userId, schemaName, days);

    return NextResponse.json({
      userId,
      schemaName,
      days,
      summary,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
