import { eq, and } from "drizzle-orm";
import type { FluidDb } from "./connection";
import { suggestions } from "./schema";

export interface Suggestion {
  id: string;
  userId: string;
  schemaName: string;
  type: "remove_cold" | "promote_hot" | "layout_change" | "density_change";
  message: string;
  proposedIntent: string;
  status: "pending" | "accepted" | "dismissed";
  createdAt: Date;
  resolvedAt: Date | null;
}

/**
 * Insert a new suggestion. Deduplicates by (userId, type, status=pending).
 */
export async function insertSuggestion(
  db: FluidDb,
  s: {
    userId: string;
    schemaName: string;
    type: Suggestion["type"];
    message: string;
    proposedIntent: string;
  },
): Promise<Suggestion | null> {
  // Deduplicate: don't insert if there's already a pending suggestion of the same type.
  const existing = await db
    .select({ id: suggestions.id })
    .from(suggestions)
    .where(
      and(
        eq(suggestions.userId, s.userId),
        eq(suggestions.type, s.type),
        eq(suggestions.status, "pending"),
      ),
    )
    .limit(1);

  if (existing.length > 0) return null;

  const [row] = await db
    .insert(suggestions)
    .values({
      userId: s.userId,
      schemaName: s.schemaName,
      type: s.type,
      message: s.message,
      proposedIntent: s.proposedIntent,
    })
    .returning();

  return {
    id: row.id,
    userId: row.userId,
    schemaName: row.schemaName,
    type: row.type as Suggestion["type"],
    message: row.message,
    proposedIntent: row.proposedIntent,
    status: row.status as Suggestion["status"],
    createdAt: row.createdAt,
    resolvedAt: row.resolvedAt,
  };
}

/**
 * Get pending suggestions for a user.
 */
export async function getPendingSuggestions(
  db: FluidDb,
  userId: string,
): Promise<Suggestion[]> {
  const rows = await db
    .select()
    .from(suggestions)
    .where(
      and(
        eq(suggestions.userId, userId),
        eq(suggestions.status, "pending"),
      ),
    );

  return rows.map((row) => ({
    id: row.id,
    userId: row.userId,
    schemaName: row.schemaName,
    type: row.type as Suggestion["type"],
    message: row.message,
    proposedIntent: row.proposedIntent,
    status: row.status as Suggestion["status"],
    createdAt: row.createdAt,
    resolvedAt: row.resolvedAt,
  }));
}

/**
 * Resolve a suggestion (accept or dismiss).
 */
export async function resolveSuggestion(
  db: FluidDb,
  suggestionId: string,
  action: "accepted" | "dismissed",
): Promise<Suggestion | null> {
  const [row] = await db
    .update(suggestions)
    .set({ status: action, resolvedAt: new Date() })
    .where(eq(suggestions.id, suggestionId))
    .returning();

  if (!row) return null;

  return {
    id: row.id,
    userId: row.userId,
    schemaName: row.schemaName,
    type: row.type as Suggestion["type"],
    message: row.message,
    proposedIntent: row.proposedIntent,
    status: row.status as Suggestion["status"],
    createdAt: row.createdAt,
    resolvedAt: row.resolvedAt,
  };
}
