import { NextRequest, NextResponse } from "next/server";
import { getEngine, getDb } from "@/lib/engine";
import { taskSchema } from "@/schemas/tasks.fluid";
import {
  resolveSuggestion,
  getActiveSnapshot,
  createSnapshot,
  appendMessage,
} from "@fluid-genui/db";
import type { Suggestion } from "@fluid-genui/db";

/**
 * POST /api/suggestions/resolve — Accept or dismiss a suggestion.
 *
 * Body: { suggestionId: string, action: "accept" | "dismiss", userId: string }
 * Response: { ok, newIR?, newSnapshotId?, newVersion? }
 */
export async function POST(req: NextRequest) {
  const body = await req.json();
  const { suggestionId, action, userId } = body;

  if (!suggestionId || !action || !userId) {
    return NextResponse.json(
      { error: "suggestionId, action, and userId are required" },
      { status: 400 },
    );
  }

  if (action !== "accept" && action !== "dismiss") {
    return NextResponse.json(
      { error: "action must be 'accept' or 'dismiss'" },
      { status: 400 },
    );
  }

  const db = getDb();
  const resolved = await resolveSuggestion(db, suggestionId, action === "accept" ? "accepted" : "dismissed");

  if (!resolved) {
    return NextResponse.json(
      { error: "Suggestion not found" },
      { status: 404 },
    );
  }

  if (action === "dismiss") {
    return NextResponse.json({ ok: true });
  }

  // Action is "accept" — run engine.patch() with the suggestion's proposed intent.
  const activeSnapshot = await getActiveSnapshot(db, userId, resolved.schemaName);
  if (!activeSnapshot) {
    return NextResponse.json(
      { error: "No active snapshot found. Generate a UI first." },
      { status: 404 },
    );
  }

  const engine = getEngine();
  const result = await engine.patch({
    schema: taskSchema,
    userId,
    currentIR: activeSnapshot.irJson,
    message: resolved.proposedIntent,
  });

  if (result.canApply && result.newIR) {
    const snapshot = await createSnapshot(db, {
      userId,
      schemaName: resolved.schemaName,
      irJson: result.newIR,
      source: "suggestion",
      changeDesc: `Accepted suggestion: ${resolved.message}`,
      parentId: activeSnapshot.id,
    });

    await appendMessage(db, {
      userId,
      schemaName: resolved.schemaName,
      role: "assistant",
      content: `Applied suggestion: ${resolved.message}`,
      snapshotId: snapshot.id,
      wasApplied: true,
    });

    return NextResponse.json({
      ok: true,
      newIR: result.newIR,
      newSnapshotId: snapshot.id,
      newVersion: snapshot.version,
    });
  } else {
    return NextResponse.json({
      ok: false,
      error: result.explanation,
    });
  }
}
