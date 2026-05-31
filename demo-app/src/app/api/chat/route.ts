import { NextRequest, NextResponse } from "next/server";
import { getEngine, getDb } from "@/lib/engine";
import { demoSchema } from "@/schemas/demo.fluid";
import {
  appendMessage,
  getMessages,
  createSnapshot,
  getActiveSnapshot,
} from "@fluid/db";
import type { FluidIR } from "@fluid/core";

/**
 * POST /api/chat
 *
 * Conversational IR patching. Send a message describing how to change the UI,
 * get back a modified IR (or a clarification request).
 *
 * Features:
 * - Loads current IR from snapshot
 * - Includes recent chat history for context
 * - Creates new snapshot on successful patch
 * - Persists all messages (user + assistant)
 */
export async function POST(req: NextRequest) {
  const body = await req.json();
  const { message, currentSnapshotId, userId, schemaName = "demo" } = body;

  if (!message || !userId) {
    return NextResponse.json(
      { error: "message and userId are required" },
      { status: 400 }
    );
  }

  const engine = getEngine();
  const db = getDb();

  // Resolve current IR — prefer the client-supplied IR (most up to date,
  // includes any already-applied chat patches), fall back to DB snapshot.
  let currentIR: FluidIR;
  if (body.currentIR) {
    currentIR = body.currentIR;
  } else if (currentSnapshotId) {
    const snapshot = await getActiveSnapshot(db, userId, schemaName);
    if (snapshot) {
      currentIR = snapshot.irJson;
    } else {
      return NextResponse.json(
        { error: "Active snapshot not found. Generate a UI first." },
        { status: 404 }
      );
    }
  } else {
    return NextResponse.json(
      { error: "currentIR or currentSnapshotId is required" },
      { status: 400 }
    );
  }

  // Load recent chat history for context
  const chatHistory = await getMessages(db, userId, schemaName, 10);
  const patchHistory = chatHistory.map((m) => ({
    role: m.role as "user" | "assistant",
    content: m.content,
  }));

  // Call engine.patch()
  const result = await engine.patch({
    schema: demoSchema,
    userId,
    currentIR,
    message,
    chatHistory: patchHistory,
  });

  // Persist user message
  await appendMessage(db, {
    userId,
    schemaName,
    role: "user",
    content: message,
  });

  if (result.canApply && result.newIR) {
    // Create new snapshot
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

    // Persist assistant reply
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
    // Persist rejection/clarification
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
 * GET /api/chat
 *
 * Load chat history for a user.
 *
 * Query params:
 * - userId (required)
 * - schemaName (optional, defaults to "demo")
 * - limit (optional, defaults to 50)
 */
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const userId = url.searchParams.get("userId");
  const schemaName = url.searchParams.get("schemaName") || "demo";
  const limit = parseInt(url.searchParams.get("limit") || "50", 10);

  if (!userId) {
    return NextResponse.json({ error: "userId is required" }, { status: 400 });
  }

  const db = getDb();
  const messages = await getMessages(db, userId, schemaName, limit);

  return NextResponse.json({ messages });
}
