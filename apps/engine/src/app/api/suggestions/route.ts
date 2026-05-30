import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/engine";
import { getPendingSuggestions } from "@fluid/db";

/**
 * GET /api/suggestions — Fetch pending suggestions for a user.
 *
 * Query: ?userId=...
 * Response: { suggestions: Suggestion[] }
 */
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const userId = url.searchParams.get("userId");

  if (!userId) {
    return NextResponse.json({ error: "userId is required" }, { status: 400 });
  }

  const db = getDb();
  const items = await getPendingSuggestions(db, userId);

  return NextResponse.json({ suggestions: items });
}
