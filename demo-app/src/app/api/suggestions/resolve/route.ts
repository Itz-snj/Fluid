import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/engine";
import { resolveSuggestion } from "@fluid/db";

/**
 * POST /api/suggestions/resolve
 *
 * Accept or dismiss an AI suggestion.
 *
 * Body:
 * - suggestionId (required)
 * - action: "accept" | "dismiss" (required)
 * - userId (required)
 */
export async function POST(req: NextRequest) {
  const body = await req.json();
  const { suggestionId, action, userId } = body;

  if (!suggestionId || !action || !userId) {
    return NextResponse.json(
      { error: "suggestionId, action, and userId are required" },
      { status: 400 }
    );
  }

  if (action !== "accept" && action !== "dismiss") {
    return NextResponse.json(
      { error: 'action must be "accept" or "dismiss"' },
      { status: 400 }
    );
  }

  const db = getDb();

  try {
    await resolveSuggestion(db, suggestionId, action, userId);

    return NextResponse.json({
      ok: true,
      message: `Suggestion ${action}ed`,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
