import { eq, and, gte, sql, inArray } from "drizzle-orm";
import type { UsageEvent, UsageSummary, UsageTracker } from "@fluid/engine";
import type { FluidDb } from "./connection";
import { usageEvents, userProfiles } from "./schema";

/** Minimum event count before a summary is considered meaningful. */
const MIN_EVENTS_FOR_SUMMARY = 10;

/**
 * PostgreSQL-backed UsageTracker.
 *
 * recordBatch: bulk INSERT using Drizzle's values([...]) — one round-trip
 * regardless of batch size.
 *
 * summarize: two aggregation queries:
 *   Q1 — entity affinities: COUNT(*) GROUP BY entity, normalised 0-1.
 *   Q2 — hot/cold node types: viewed vs clicked using conditional aggregates.
 *   Q3 — active hours: EXTRACT(hour) histogram.
 */
export function createPgUsageTracker(db: FluidDb): UsageTracker {
  return {
    async recordBatch(events: UsageEvent[]): Promise<void> {
      if (events.length === 0) return;

      // Ensure all user profile rows exist (FK constraint on usage_events.user_id)
      const uniqueUserIds = [...new Set(events.map((e) => e.userId))];
      await db
        .insert(userProfiles)
        .values(uniqueUserIds.map((userId) => ({ userId })))
        .onConflictDoNothing();

      await db.insert(usageEvents).values(
        events.map((e) => ({
          userId: e.userId,
          schemaName: e.schemaName,
          irId: e.irId ?? null,
          nodeType: e.nodeType,
          nodeId: e.nodeId ?? null,
          entity: e.entity ?? null,
          action: e.action,
          device: e.device ?? null,
          viewportWidth: e.viewportWidth ?? null,
          createdAt: new Date(e.timestamp),
        })),
      );
    },

    async summarize(
      userId: string,
      schemaName: string,
      windowDays = 7,
    ): Promise<UsageSummary | null> {
      const since = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000);

      // Q1: total event count (quick check)
      const countResult = await db
        .select({ total: sql<number>`count(*)::int` })
        .from(usageEvents)
        .where(
          and(
            eq(usageEvents.userId, userId),
            eq(usageEvents.schemaName, schemaName),
            gte(usageEvents.createdAt, since),
          ),
        );

      const totalEvents = countResult[0]?.total ?? 0;
      if (totalEvents < MIN_EVENTS_FOR_SUMMARY) return null;

      // Q2: entity affinities
      const entityRows = await db
        .select({
          entity: usageEvents.entity,
          cnt: sql<number>`count(*)::int`,
        })
        .from(usageEvents)
        .where(
          and(
            eq(usageEvents.userId, userId),
            eq(usageEvents.schemaName, schemaName),
            gte(usageEvents.createdAt, since),
            sql`entity IS NOT NULL`,
          ),
        )
        .groupBy(usageEvents.entity);

      const entityTotal = entityRows.reduce((s, r) => s + r.cnt, 0) || 1;
      const entityAffinities: Record<string, number> = {};
      for (const r of entityRows) {
        if (r.entity) {
          entityAffinities[r.entity] = parseFloat((r.cnt / entityTotal).toFixed(3));
        }
      }

      // Q3: hot node types (clicked)
      const clickRows = await db
        .select({
          nodeType: usageEvents.nodeType,
          entity: usageEvents.entity,
          cnt: sql<number>`count(*)::int`,
        })
        .from(usageEvents)
        .where(
          and(
            eq(usageEvents.userId, userId),
            eq(usageEvents.schemaName, schemaName),
            gte(usageEvents.createdAt, since),
            eq(usageEvents.action, "click"),
          ),
        )
        .groupBy(usageEvents.nodeType, usageEvents.entity)
        .orderBy(sql`count(*) DESC`)
        .limit(20);

      const hotNodeTypes = clickRows.map((r) => ({
        type: r.nodeType,
        entity: r.entity ?? undefined,
        count: r.cnt,
      }));

      // Q4: cold node types (viewed but never clicked)
      const viewedRows = await db
        .select({
          nodeType: usageEvents.nodeType,
          entity: usageEvents.entity,
        })
        .from(usageEvents)
        .where(
          and(
            eq(usageEvents.userId, userId),
            eq(usageEvents.schemaName, schemaName),
            gte(usageEvents.createdAt, since),
            eq(usageEvents.action, "view"),
          ),
        )
        .groupBy(usageEvents.nodeType, usageEvents.entity);

      const clickedSet = new Set(
        clickRows.map((r) => `${r.nodeType}|${r.entity ?? ""}`),
      );
      const coldNodeTypes = viewedRows
        .filter((r) => !clickedSet.has(`${r.nodeType}|${r.entity ?? ""}`))
        .map((r) => ({ type: r.nodeType, entity: r.entity ?? undefined }));

      // Q5: hour-of-day histogram
      const hourRows = await db
        .select({
          hour: sql<number>`extract(hour from created_at)::int`,
          cnt: sql<number>`count(*)::int`,
        })
        .from(usageEvents)
        .where(
          and(
            eq(usageEvents.userId, userId),
            eq(usageEvents.schemaName, schemaName),
            gte(usageEvents.createdAt, since),
          ),
        )
        .groupBy(sql`extract(hour from created_at)`);

      const activeHours = Array.from({ length: 24 }, (_, i) => {
        const row = hourRows.find((r) => r.hour === i);
        return row?.cnt ?? 0;
      });

      // Infer layout from hottest node type
      const topNode = hotNodeTypes[0]?.type;
      const inferredLayout =
        topNode === "kanban"
          ? "kanban"
          : topNode === "list"
            ? "list"
            : topNode === "stat" || topNode === "grid"
              ? "dashboard"
              : topNode === "split"
                ? "split"
                : undefined;

      // Infer density from click-to-view ratio: many clicks per view = compact
      const clickCount = clickRows.reduce((s, r) => s + r.cnt, 0);
      const viewCount = viewedRows.length;
      const ratio = viewCount > 0 ? clickCount / viewCount : 0;
      const inferredDensity: UsageSummary["inferredDensity"] =
        ratio > 2 ? "compact" : ratio < 0.5 ? "comfortable" : undefined;

      return {
        userId,
        schemaName,
        windowDays,
        totalEvents,
        entityAffinities,
        hotNodeTypes,
        coldNodeTypes,
        inferredLayout,
        inferredDensity,
        activeHours,
      };
    },
  };
}
