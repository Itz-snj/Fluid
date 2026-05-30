import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/engine";
import { revertToSnapshot, getSnapshot } from "@fluid/db";

/**
 * POST /api/chat/revert
 *
 * Revert to a previous snapshot in the version history.
 *
 * Body:
 * - userId (required)
 * - snapshotId (required)
 * - schemaName (optional, defaults to "demo")
 */
export async function POST(req: NextRequest) {
  const body = await req.json();
  // useFluidChat sends targetSnapshotId; also accept snapshotId for backwards compat
  const { userId, targetSnapshotId, snapshotId, schemaName = "demo" } = body;
  const resolvedSnapshotId = targetSnapshotId ?? snapshotId;

  if (!userId || !resolvedSnapshotId) {
    return NextResponse.json(
      { error: "userId and targetSnapshotId are required" },
      { status: 400 }
    );
  }

  const db = getDb();

  try {
    // Creates a new snapshot with the target's IR (append-only version chain)
    const newSnapshot = await revertToSnapshot(db, userId, schemaName, resolvedSnapshotId);

    // Load the full data including irJson
    const snapshot = await getSnapshot(db, newSnapshot.id);
    if (!snapshot) {
      return NextResponse.json({ error: "Snapshot not found after revert" }, { status: 500 });
    }

    // Return field names matching what useFluidChat expects
    return NextResponse.json({
      ok: true,
      newIR: snapshot.irJson,
      newSnapshotId: snapshot.id,
      newVersion: snapshot.version,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
