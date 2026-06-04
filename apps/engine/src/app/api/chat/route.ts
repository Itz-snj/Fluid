import { NextRequest, NextResponse } from "next/server";
import { getEngine, getDb } from "@/lib/engine";
import { taskSchema } from "@/schemas/tasks.fluid";
import {
  appendMessage,
  getMessages,
  createSnapshot,
  getActiveSnapshot,
} from "@fluid-genui/db";
import type { FluidIR } from "@fluid-genui/core";

/**
 * POST /api/chat — Send a chat message, get a patch result.
 *
 * Body: { message: string, currentSnapshotId: string, userId: string, schemaName?: string }
 * Response: { reply, canApply, newIR?, newSnapshotId?, clarify? }
 */
export async function POST(req: NextRequest) {
  const body = await req.json();
  const { message, currentSnapshotId, userId, schemaName = "tasks" } = body;

  if (!message || !userId) {
    return NextResponse.json(
      { error: "message and userId are required" },
      { status: 400 },
    );
  }

  const engine = getEngine();
  const db = getDb();

  // Load the current IR from snapshot (or from the body as fallback).
  let currentIR: FluidIR;
  if (currentSnapshotId) {
    const snapshot = await getActiveSnapshot(db, userId, schemaName);
    if (snapshot) {
      currentIR = snapshot.irJson;
    } else {
      return NextResponse.json(
        { error: "Active snapshot not found. Generate a UI first." },
        { status: 404 },
      );
    }
  } else if (body.currentIR) {
    currentIR = body.currentIR;
  } else {
    return NextResponse.json(
      { error: "currentSnapshotId or currentIR is required" },
      { status: 400 },
    );
  }

  // Load recent chat history for context.
  const chatHistory = await getMessages(db, userId, schemaName, 10);
  const patchHistory = chatHistory.map((m) => ({
    role: m.role as "user" | "assistant",
    content: m.content,
  }));

  // Call engine.patch().
  const result = await engine.patch({
    schema: taskSchema,
    userId,
    currentIR,
    message,
    chatHistory: patchHistory,
  });

  // Persist user message.
  await appendMessage(db, {
    userId,
    schemaName,
    role: "user",
    content: message,
  });

  if (result.canApply && result.newIR) {
    // Create a new snapshot.
    const activeSnapshot = currentSnapshotId
      ? await getActiveSnapshot(db, userId, schemaName)
      : null;

    const snapshot = await createSnapshot(db, {
      userId,
      schemaName,
      irJson: result.newIR,
      source: "patch",
      changeDesc: result.explanation,
      parentId: activeSnapshot?.id,
    });

    // Persist assistant reply.
    await appendMessage(db, {
      userId,
      schemaName,
      role: "assistant",
      content: result.explanation,
      snapshotId: snapshot.id,
      wasApplied: true,
    });

    return NextResponse.json({
      reply: result.explanation,
      canApply: true,
      newIR: result.newIR,
      newSnapshotId: snapshot.id,
      newVersion: snapshot.version,
    });
  } else {
    // Persist the rejection/clarification.
    await appendMessage(db, {
      userId,
      schemaName,
      role: "assistant",
      content: result.explanation,
      wasApplied: false,
    });

    return NextResponse.json({
      reply: result.explanation,
      canApply: false,
      clarify: result.clarify,
    });
  }
}

/**
 * GET /api/chat — Load chat history.
 *
 * Query: ?userId=...&schemaName=...&limit=50
 */
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const userId = url.searchParams.get("userId");
  const schemaName = url.searchParams.get("schemaName") || "tasks";
  const limit = parseInt(url.searchParams.get("limit") || "50", 10);

  if (!userId) {
    return NextResponse.json({ error: "userId is required" }, { status: 400 });
  }

  const db = getDb();
  const messages = await getMessages(db, userId, schemaName, limit);

  return NextResponse.json({ messages });
}
