import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/engine";
import { getSnapshotHistory } from "@fluid-genui/db";

/**
 * GET /api/ir/history — List IR version history for a user.
 *
 * Query: ?userId=...&schemaName=...&limit=20
 * Response: { snapshots: [{id, version, source, changeDesc, createdAt, isActive}] }
 */
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const userId = url.searchParams.get("userId");
  const schemaName = url.searchParams.get("schemaName") || "tasks";
  const limit = parseInt(url.searchParams.get("limit") || "20", 10);

  if (!userId) {
    return NextResponse.json({ error: "userId is required" }, { status: 400 });
  }

  const db = getDb();
  const snapshots = await getSnapshotHistory(db, userId, schemaName, limit);

  // Don't send full IR JSON in the history listing — just metadata.
  const items = snapshots.map((s) => ({
    id: s.id,
    version: s.version,
    source: s.source,
    changeDesc: s.changeDesc,
    createdAt: s.createdAt.toISOString(),
  }));

  return NextResponse.json({ snapshots: items });
}
