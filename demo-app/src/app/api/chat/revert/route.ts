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
    // The snapshotId passed is the snapshot CREATED by the patch (e.g. v2, the list view).
    // "Revert this change" means go BACK to what was before that patch — i.e. v2's parent (v1, the kanban).
    const patchedSnapshot = await getSnapshot(db, resolvedSnapshotId);
    if (!patchedSnapshot) {
      return NextResponse.json({ error: `Snapshot ${resolvedSnapshotId} not found` }, { status: 404 });
    }

    // If there's a parent, revert to it. If it's the root snapshot, revert to itself.
    const revertTargetId = patchedSnapshot.parentId ?? resolvedSnapshotId;
    const newSnapshot = await revertToSnapshot(db, userId, schemaName, revertTargetId);

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
