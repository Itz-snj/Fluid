import { eq, and, isNull } from "drizzle-orm";
import type { ProfileStore, IntentProfile } from "@fluid/engine";
import type { FluidDb } from "./connection";
import { userProfiles } from "./schema";

/**
 * PostgreSQL-backed ProfileStore.
 *
 * Profile rows are upserted (not inserted then updated) so concurrent writes
 * from multiple server instances converge to the latest state.
 * The intent_history column is JSONB — a single row read loads the full profile.
 */
export function createPgProfileStore(db: FluidDb): ProfileStore {
  return {
    async get(userId: string): Promise<IntentProfile | null> {
      const rows = await db
        .select()
        .from(userProfiles)
        .where(eq(userProfiles.userId, userId))
        .limit(1);

      const row = rows[0];
      if (!row) return null;

      return {
        userId: row.userId,
        history: (row.intentHistory as IntentProfile["history"]) ?? [],
        updatedAt: row.updatedAt.getTime(),
      };
    },

    async set(userId: string, profile: IntentProfile): Promise<void> {
      await db
        .insert(userProfiles)
        .values({
          userId,
          intentHistory: JSON.parse(JSON.stringify(profile.history)),
          updatedAt: new Date(profile.updatedAt),
        })
        .onConflictDoUpdate({
          target: userProfiles.userId,
          set: {
            intentHistory: JSON.parse(JSON.stringify(profile.history)),
            updatedAt: new Date(profile.updatedAt),
          },
        });
    },

    async delete(userId: string): Promise<void> {
      await db.delete(userProfiles).where(eq(userProfiles.userId, userId));
    },
  };
}

/**
 * Upsert a user's role / device context into the profile row.
 * Called by the app layer when auth context changes.
 */
export async function upsertUserContext(
  db: FluidDb,
  userId: string,
  ctx: { role?: string; lastDevice?: string },
): Promise<void> {
  await db
    .insert(userProfiles)
    .values({
      userId,
      intentHistory: [],
      ...(ctx.role ? { role: ctx.role } : {}),
      ...(ctx.lastDevice ? { lastDevice: ctx.lastDevice } : {}),
    })
    .onConflictDoUpdate({
      target: userProfiles.userId,
      set: {
        ...(ctx.role ? { role: ctx.role } : {}),
        ...(ctx.lastDevice ? { lastDevice: ctx.lastDevice } : {}),
        updatedAt: new Date(),
      },
    });
}

export { isNull, and }; // re-exported for refresh-queue usage
