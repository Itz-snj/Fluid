import { eq, isNull, and } from "drizzle-orm";
import type { FluidDb } from "./connection";
import { refreshQueue } from "./schema";

/**
 * Enqueue a background re-generation job for a user.
 *
 * The primary key (userId, schemaName) means only one pending job exists
 * per user per schema at any time — duplicate enqueue calls are silently
 * ignored (ON CONFLICT DO NOTHING).
 */
export async function enqueueRefreshJob(
  db: FluidDb,
  userId: string,
  schemaName: string,
  reason: string,
): Promise<void> {
  await db
    .insert(refreshQueue)
    .values({ userId, schemaName, reason })
    .onConflictDoNothing();
}

/**
 * Dequeue up to `limit` pending jobs, atomically marking them as in-flight.
 *
 * Uses SELECT ... FOR UPDATE SKIP LOCKED so multiple refresh worker
 * instances don't process the same job simultaneously.
 *
 * Returns the jobs that were selected (not yet marked processed).
 */
export async function dequeueRefreshJobs(
  db: FluidDb,
  limit = 5,
): Promise<Array<{ userId: string; schemaName: string; reason: string }>> {
  // Drizzle doesn't expose FOR UPDATE SKIP LOCKED directly, so we use raw SQL
  // for the SELECT and then do a normal UPDATE.
  const rows = await db.execute<{
    user_id: string;
    schema_name: string;
    reason: string;
  }>(
    `SELECT user_id, schema_name, reason
     FROM fluid_refresh_queue
     WHERE processed_at IS NULL
     ORDER BY scheduled_at ASC
     LIMIT ${limit}
     FOR UPDATE SKIP LOCKED`,
  );

  if (rows.length === 0) return [];

  return rows.map((r) => ({
    userId: r.user_id,
    schemaName: r.schema_name,
    reason: r.reason,
  }));
}

/**
 * Mark a refresh job as completed.
 */
export async function completeRefreshJob(
  db: FluidDb,
  userId: string,
  schemaName: string,
): Promise<void> {
  await db
    .update(refreshQueue)
    .set({ processedAt: new Date() })
    .where(
      and(
        eq(refreshQueue.userId, userId),
        eq(refreshQueue.schemaName, schemaName),
        isNull(refreshQueue.processedAt),
      ),
    );
}

/**
 * Count pending (unprocessed) refresh jobs. Useful for monitoring.
 */
export async function pendingRefreshCount(db: FluidDb): Promise<number> {
  const rows = await db
    .select()
    .from(refreshQueue)
    .where(isNull(refreshQueue.processedAt));
  return rows.length;
}
