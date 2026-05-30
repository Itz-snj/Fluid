import { eq, and, desc } from "drizzle-orm";
import type { FluidDb } from "./connection";
import { chatMessages, userProfiles } from "./schema";

export interface ChatMessage {
  id: number;
  userId: string;
  schemaName: string;
  role: "user" | "assistant" | "suggestion";
  content: string;
  snapshotId: string | null;
  wasApplied: boolean;
  createdAt: Date;
}

/**
 * Append a message to the chat history.
 */
export async function appendMessage(
  db: FluidDb,
  msg: {
    userId: string;
    schemaName: string;
    role: "user" | "assistant" | "suggestion";
    content: string;
    snapshotId?: string;
    wasApplied?: boolean;
  },
): Promise<ChatMessage> {
  // Ensure user profile row exists before inserting (FK constraint).
  await db
    .insert(userProfiles)
    .values({ userId: msg.userId })
    .onConflictDoNothing({ target: userProfiles.userId });

  const [row] = await db
    .insert(chatMessages)
    .values({
      userId: msg.userId,
      schemaName: msg.schemaName,
      role: msg.role,
      content: msg.content,
      snapshotId: msg.snapshotId ?? null,
      wasApplied: msg.wasApplied ?? false,
    })
    .returning();

  return {
    id: row.id,
    userId: row.userId,
    schemaName: row.schemaName,
    role: row.role as ChatMessage["role"],
    content: row.content,
    snapshotId: row.snapshotId,
    wasApplied: row.wasApplied,
    createdAt: row.createdAt,
  };
}

/**
 * Load chat messages for a user, newest last (chronological order).
 */
export async function getMessages(
  db: FluidDb,
  userId: string,
  schemaName: string,
  limit = 50,
): Promise<ChatMessage[]> {
  const rows = await db
    .select()
    .from(chatMessages)
    .where(
      and(
        eq(chatMessages.userId, userId),
        eq(chatMessages.schemaName, schemaName),
      ),
    )
    .orderBy(desc(chatMessages.createdAt))
    .limit(limit);

  // Reverse to chronological order (oldest first).
  return rows.reverse().map((row) => ({
    id: row.id,
    userId: row.userId,
    schemaName: row.schemaName,
    role: row.role as ChatMessage["role"],
    content: row.content,
    snapshotId: row.snapshotId,
    wasApplied: row.wasApplied,
    createdAt: row.createdAt,
  }));
}

/**
 * Mark a message as applied (used when the user accepts a suggestion).
 */
export async function markApplied(
  db: FluidDb,
  messageId: number,
): Promise<void> {
  await db
    .update(chatMessages)
    .set({ wasApplied: true })
    .where(eq(chatMessages.id, messageId));
}
