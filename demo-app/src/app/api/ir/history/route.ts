import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/engine";
import { getSnapshotHistory } from "@fluid/db";

/**
 * GET /api/ir/history
 *
 * Get version history (snapshots) for a user.
 *
 * Query params:
 * - userId (required)
 * - schemaName (optional, defaults to "demo")
 * - limit (optional, defaults to 20)
 */
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const userId = url.searchParams.get("userId");
  const schemaName = url.searchParams.get("schemaName") || "demo";
  const limit = parseInt(url.searchParams.get("limit") || "20", 10);

  if (!userId) {
    return NextResponse.json({ error: "userId is required" }, { status: 400 });
  }

  const db = getDb();

  try {
    const history = await getSnapshotHistory(db, userId, schemaName, limit);

    return NextResponse.json({
      userId,
      schemaName,
      history: history.map((s) => ({
        id: s.id,
        version: s.version,
        source: s.source,
        changeDesc: s.changeDesc,
        createdAt: s.createdAt,
        isActive: s.isActive,
      })),
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
