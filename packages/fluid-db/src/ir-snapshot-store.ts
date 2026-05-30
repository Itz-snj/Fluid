import { eq, and, desc, sql } from "drizzle-orm";
import type { FluidDb } from "./connection";
import { irSnapshots, userProfiles } from "./schema";
import type { FluidIR } from "@fluid/core";

export type SnapshotSource = "generate" | "patch" | "revert" | "suggestion";

export interface IRSnapshot {
  id: string;
  userId: string;
  schemaName: string;
  version: number;
  irJson: FluidIR;
  parentId: string | null;
  source: SnapshotSource;
  changeDesc: string | null;
  createdAt: Date;
}

const MAX_SNAPSHOTS_PER_USER = 30;

/**
 * Create a new immutable IR snapshot.
 *
 * Auto-increments the version number per (userId, schemaName).
 * Prunes oldest non-active snapshots when over the limit.
 */
export async function createSnapshot(
  db: FluidDb,
  opts: {
    userId: string;
    schemaName: string;
    irJson: FluidIR;
    source: SnapshotSource;
    changeDesc?: string;
    parentId?: string;
  },
): Promise<IRSnapshot> {
  // Get the next version number for this user + schema.
  const [maxRow] = await db
    .select({ maxVersion: sql<number>`COALESCE(MAX(${irSnapshots.version}), 0)` })
    .from(irSnapshots)
    .where(
      and(
        eq(irSnapshots.userId, opts.userId),
        eq(irSnapshots.schemaName, opts.schemaName),
      ),
    );
  const nextVersion = (maxRow?.maxVersion ?? 0) + 1;

  const [row] = await db
    .insert(irSnapshots)
    .values({
      userId: opts.userId,
      schemaName: opts.schemaName,
      version: nextVersion,
      irJson: opts.irJson as unknown as Record<string, unknown>,
      parentId: opts.parentId ?? null,
      source: opts.source,
      changeDesc: opts.changeDesc ?? null,
    })
    .returning();

  // Set as active snapshot on the user profile.
  await db
    .update(userProfiles)
    .set({ activeSnapshotId: row.id, updatedAt: new Date() })
    .where(eq(userProfiles.userId, opts.userId));

  // Prune old snapshots if over limit.
  await pruneSnapshots(db, opts.userId, opts.schemaName);

  return {
    id: row.id,
    userId: row.userId,
    schemaName: row.schemaName,
    version: row.version,
    irJson: row.irJson as unknown as FluidIR,
    parentId: row.parentId,
    source: row.source as SnapshotSource,
    changeDesc: row.changeDesc,
    createdAt: row.createdAt,
  };
}

/**
 * Get the user's currently active snapshot.
 */
export async function getActiveSnapshot(
  db: FluidDb,
  userId: string,
  schemaName: string,
): Promise<IRSnapshot | null> {
  const [profile] = await db
    .select({ activeSnapshotId: userProfiles.activeSnapshotId })
    .from(userProfiles)
    .where(eq(userProfiles.userId, userId));

  if (!profile?.activeSnapshotId) return null;

  const [row] = await db
    .select()
    .from(irSnapshots)
    .where(eq(irSnapshots.id, profile.activeSnapshotId));

  if (!row) return null;

  return {
    id: row.id,
    userId: row.userId,
    schemaName: row.schemaName,
    version: row.version,
    irJson: row.irJson as unknown as FluidIR,
    parentId: row.parentId,
    source: row.source as SnapshotSource,
    changeDesc: row.changeDesc,
    createdAt: row.createdAt,
  };
}

/**
 * Get a specific snapshot by ID.
 */
export async function getSnapshot(
  db: FluidDb,
  snapshotId: string,
): Promise<IRSnapshot | null> {
  const [row] = await db
    .select()
    .from(irSnapshots)
    .where(eq(irSnapshots.id, snapshotId));

  if (!row) return null;

  return {
    id: row.id,
    userId: row.userId,
    schemaName: row.schemaName,
    version: row.version,
    irJson: row.irJson as unknown as FluidIR,
    parentId: row.parentId,
    source: row.source as SnapshotSource,
    changeDesc: row.changeDesc,
    createdAt: row.createdAt,
  };
}

/**
 * List snapshot history for a user, newest first.
 */
export async function getSnapshotHistory(
  db: FluidDb,
  userId: string,
  schemaName: string,
  limit = 20,
): Promise<IRSnapshot[]> {
  const rows = await db
    .select()
    .from(irSnapshots)
    .where(
      and(
        eq(irSnapshots.userId, userId),
        eq(irSnapshots.schemaName, schemaName),
      ),
    )
    .orderBy(desc(irSnapshots.version))
    .limit(limit);

  return rows.map((row) => ({
    id: row.id,
    userId: row.userId,
    schemaName: row.schemaName,
    version: row.version,
    irJson: row.irJson as unknown as FluidIR,
    parentId: row.parentId,
    source: row.source as SnapshotSource,
    changeDesc: row.changeDesc,
    createdAt: row.createdAt,
  }));
}

/**
 * Revert to a target snapshot by creating a NEW snapshot with the target's IR.
 * This keeps the version chain append-only — no data is lost.
 */
export async function revertToSnapshot(
  db: FluidDb,
  userId: string,
  schemaName: string,
  targetSnapshotId: string,
): Promise<IRSnapshot> {
  const target = await getSnapshot(db, targetSnapshotId);
  if (!target) throw new Error(`Snapshot ${targetSnapshotId} not found`);
  if (target.userId !== userId) throw new Error("Snapshot belongs to a different user");

  // Get the current active snapshot to use as parent.
  const active = await getActiveSnapshot(db, userId, schemaName);

  return createSnapshot(db, {
    userId,
    schemaName,
    irJson: target.irJson,
    source: "revert",
    changeDesc: `Reverted to v${target.version}`,
    parentId: active?.id,
  });
}

/**
 * Prune oldest snapshots when over the per-user limit.
 * Never prunes the currently active snapshot.
 */
async function pruneSnapshots(
  db: FluidDb,
  userId: string,
  schemaName: string,
): Promise<void> {
  const [profile] = await db
    .select({ activeSnapshotId: userProfiles.activeSnapshotId })
    .from(userProfiles)
    .where(eq(userProfiles.userId, userId));

  const all = await db
    .select({ id: irSnapshots.id })
    .from(irSnapshots)
    .where(
      and(
        eq(irSnapshots.userId, userId),
        eq(irSnapshots.schemaName, schemaName),
      ),
    )
    .orderBy(desc(irSnapshots.version));

  if (all.length <= MAX_SNAPSHOTS_PER_USER) return;

  const toDelete = all
    .slice(MAX_SNAPSHOTS_PER_USER)
    .filter((s) => s.id !== profile?.activeSnapshotId);

  if (toDelete.length > 0) {
    for (const s of toDelete) {
      await db.delete(irSnapshots).where(eq(irSnapshots.id, s.id));
    }
  }
}
