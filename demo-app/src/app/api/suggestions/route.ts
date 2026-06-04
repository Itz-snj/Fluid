import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/engine";
import { getPendingSuggestions } from "@fluid/db";

/**
 * GET /api/suggestions
 *
 * Fetch pending AI suggestions for a user.
 *
 * Suggestions are proactive UI improvements based on:
 * - Usage patterns (telemetry)
 * - Common workflows
 * - Data characteristics
 *
 * Query params:
 * - userId (required)
 * - schemaName (optional, defaults to "demo")
 */
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const userId = url.searchParams.get("userId");
  const schemaName = url.searchParams.get("schemaName") || "demo";

  if (!userId) {
    return NextResponse.json({ error: "userId is required" }, { status: 400 });
  }

  const db = getDb();
  const all = await getPendingSuggestions(db, userId);
  const suggestions = all.filter((s) => s.schemaName === schemaName);

  return NextResponse.json({ suggestions });
}
