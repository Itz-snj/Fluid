import {
  pgTable,
  text,
  jsonb,
  timestamp,
  bigserial,
  serial,
  boolean,
  integer,
  primaryKey,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";


/**
 * Drizzle schema for all Fluid database tables.
 *
 * Table responsibilities:
 *   fluid_user_profiles  — user identity, intent history, behavioral preferences
 *   fluid_generated_irs  — versioned IR storage per user (replaces in-memory cache)
 *   fluid_usage_events   — raw interaction telemetry (click, view, scroll …)
 *   fluid_refresh_queue  — pending auto-regeneration jobs
 *   fluid_ir_snapshots   — immutable version chain for rollback
 *   fluid_chat_messages  — chatbot conversation log
 *   fluid_suggestions    — proactive telemetry-driven suggestions
 */

// ────────────────────────────────────────────────────────────
// 1. User profiles
// ────────────────────────────────────────────────────────────
export const userProfiles = pgTable("fluid_user_profiles", {
  userId: text("user_id").primaryKey(),
  schemaName: text("schema_name").notNull().default("default"),

  // The learn loop's intent history — [{intent, at}]
  intentHistory: jsonb("intent_history").notNull().default([]),

  // Derived from telemetry aggregation (updated by the refresh worker)
  entityAffinities: jsonb("entity_affinities").default({}),   // {Deal: 0.85}
  layoutPreference: text("layout_preference"),                 // "kanban"|"list"|…
  densityPreference: text("density_preference"),               // "compact"|"comfortable"

  // Context signals (written by the app, read by the engine)
  role: text("role"),
  lastDevice: text("last_device"),
  peakHours: jsonb("peak_hours").default([]),   // [9,10,11,14]

  // Which IR the user is currently seeing
  activeIrId: text("active_ir_id"),

  // ── Chatbot additions ──
  /** When true, the system generates proactive suggestions from telemetry. */
  autoAdapt: boolean("auto_adapt").notNull().default(true),
  /** FK to fluid_ir_snapshots — the snapshot the user is currently viewing. */
  activeSnapshotId: text("active_snapshot_id"),

  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// ────────────────────────────────────────────────────────────
// 2. Generated IRs (cache layer — unchanged)
// ────────────────────────────────────────────────────────────
export const generatedIrs = pgTable(
  "fluid_generated_irs",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id")
      .notNull()
      .references(() => userProfiles.userId, { onDelete: "cascade" }),
    schemaName: text("schema_name").notNull(),
    cacheKey: text("cache_key").notNull(),

    irJson: jsonb("ir_json").notNull(),
    archetype: text("archetype"),

    intentUsed: text("intent_used").notNull(),
    wasRefined: boolean("was_refined").notNull().default(false),
    attempts: integer("attempts").notNull().default(1),
    latencyMs: integer("latency_ms"),
    inputTokens: integer("input_tokens"),
    outputTokens: integer("output_tokens"),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
  },
  (t) => [
    uniqueIndex("idx_ir_cache_key").on(t.cacheKey),
    index("idx_ir_user").on(t.userId, t.schemaName),
  ],
);

// ────────────────────────────────────────────────────────────
// 3. Usage events (high-throughput, append-only)
// ────────────────────────────────────────────────────────────
export const usageEvents = pgTable(
  "fluid_usage_events",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => userProfiles.userId, { onDelete: "cascade" }),
    schemaName: text("schema_name").notNull(),
    irId: text("ir_id").references(() => generatedIrs.id, { onDelete: "set null" }),

    nodeType: text("node_type").notNull(),   // "kanban"|"list"|"card"|…
    nodeId: text("node_id"),
    entity: text("entity"),
    action: text("action").notNull(),         // "click"|"view"|"scroll"|…
    device: text("device"),
    viewportWidth: integer("viewport_width"),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("idx_events_user").on(t.userId, t.createdAt),
  ],
);

// ────────────────────────────────────────────────────────────
// 4. Refresh queue
// ────────────────────────────────────────────────────────────
export const refreshQueue = pgTable(
  "fluid_refresh_queue",
  {
    userId: text("user_id")
      .notNull()
      .references(() => userProfiles.userId, { onDelete: "cascade" }),
    schemaName: text("schema_name").notNull(),
    reason: text("reason").notNull(),
    scheduledAt: timestamp("scheduled_at", { withTimezone: true }).notNull().defaultNow(),
    processedAt: timestamp("processed_at", { withTimezone: true }),
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.schemaName] }),
  ],
);

// ────────────────────────────────────────────────────────────
// 5. IR Snapshots — immutable version chain for rollback
// ────────────────────────────────────────────────────────────
export const irSnapshots = pgTable(
  "fluid_ir_snapshots",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id")
      .notNull()
      .references(() => userProfiles.userId, { onDelete: "cascade" }),
    schemaName: text("schema_name").notNull(),

    /** Auto-incrementing version per user (for display: "v3"). */
    version: integer("version").notNull(),
    /** The complete IR JSON at this version. */
    irJson: jsonb("ir_json").notNull(),
    /** FK to the snapshot this was derived from. Null for the first generate. */
    parentId: text("parent_id"),

    /** What created this snapshot. */
    source: text("source").notNull(),  // "generate" | "patch" | "revert" | "suggestion"
    /** Human-readable description of the change. */
    changeDesc: text("change_desc"),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("idx_snapshots_user").on(t.userId, t.schemaName, t.version),
  ],
);

// ────────────────────────────────────────────────────────────
// 6. Chat messages — conversation log for the chatbot
// ────────────────────────────────────────────────────────────
export const chatMessages = pgTable(
  "fluid_chat_messages",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => userProfiles.userId, { onDelete: "cascade" }),
    schemaName: text("schema_name").notNull(),

    /** "user" | "assistant" | "suggestion" */
    role: text("role").notNull(),
    content: text("content").notNull(),

    /** Links to the snapshot this message produced (null for user messages). */
    snapshotId: text("snapshot_id"),
    /** Whether the user accepted this change (for suggestion/assistant messages). */
    wasApplied: boolean("was_applied").notNull().default(false),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("idx_chat_user").on(t.userId, t.schemaName, t.createdAt),
  ],
);

// ────────────────────────────────────────────────────────────
// 7. Suggestions — proactive telemetry-driven recommendations
// ────────────────────────────────────────────────────────────
export const suggestions = pgTable(
  "fluid_suggestions",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id")
      .notNull()
      .references(() => userProfiles.userId, { onDelete: "cascade" }),
    schemaName: text("schema_name").notNull(),

    /** "remove_cold" | "promote_hot" | "layout_change" | "density_change" */
    type: text("type").notNull(),
    /** Human-readable message shown in the chat widget. */
    message: text("message").notNull(),
    /** The intent to feed into engine.patch() if the user accepts. */
    proposedIntent: text("proposed_intent").notNull(),

    /** "pending" | "accepted" | "dismissed" */
    status: text("status").notNull().default("pending"),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
  },
  (t) => [
    index("idx_suggestions_user").on(t.userId, t.status),
  ],
);

