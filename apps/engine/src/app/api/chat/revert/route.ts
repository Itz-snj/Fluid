import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/engine";
import {
  revertToSnapshot,
  appendMessage,
} from "@fluid-genui/db";

/**
 * POST /api/chat/revert — Revert to a previous IR version.
 *
 * Body: { userId: string, targetSnapshotId: string, schemaName?: string }
 * Response: { newIR, newSnapshotId, newVersion }
 */
export async function POST(req: NextRequest) {
  const body = await req.json();
  const { userId, targetSnapshotId, schemaName = "tasks" } = body;

  if (!userId || !targetSnapshotId) {
    return NextResponse.json(
      { error: "userId and targetSnapshotId are required" },
      { status: 400 },
    );
  }

  const db = getDb();

  try {
    const newSnapshot = await revertToSnapshot(db, userId, schemaName, targetSnapshotId);

    // Append a system message to the chat.
    await appendMessage(db, {
      userId,
      schemaName,
      role: "assistant",
      content: newSnapshot.changeDesc || "Reverted to a previous version.",
      snapshotId: newSnapshot.id,
      wasApplied: true,
    });

    return NextResponse.json({
      newIR: newSnapshot.irJson,
      newSnapshotId: newSnapshot.id,
      newVersion: newSnapshot.version,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Revert failed" },
      { status: 400 },
    );
  }
}
