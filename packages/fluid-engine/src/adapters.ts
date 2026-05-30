import type { FluidIR } from "@fluid/core";

/**
 * Backing-store interfaces.
 *
 * The engine owns the IR generation logic, not the storage. Consumers plug in
 * their own implementations — Redis, Postgres, Upstash, whatever — by passing
 * objects matching these shapes to createEngine().
 *
 * The library ships in-memory defaults so the demo path works with zero setup.
 */

export interface CacheAdapter {
  get(key: string): Promise<FluidIR | null> | FluidIR | null;
  set(key: string, ir: FluidIR): Promise<void> | void;
  /** Optional: coalesce concurrent gen requests for the same key. */
  singleFlight?<T extends FluidIR>(
    key: string,
    factory: () => Promise<T>,
  ): Promise<T>;
}

export interface RateLimitDecision {
  ok: boolean;
  remaining: number;
  retryAfterMs: number;
}

export interface RateLimiter {
  check(key: string): Promise<RateLimitDecision> | RateLimitDecision;
}

/**
 * One entry in a user's intent history.
 *
 * `intent` is stored as the user typed it (after trim). We DON'T store the
 * normalized form — humans reading their own history want to see what they
 * actually said.
 */
export interface IntentHistoryEntry {
  intent: string;
  /** Epoch ms. */
  at: number;
}

/**
 * The "what Fluid has learned about this user" record.
 *
 * Kept deliberately small: a bounded recency-ordered list of past intents.
 * The merge that turns history into a "consolidated preference" happens at
 * prompt-construction time (see engine.refine), not in storage — so swapping
 * the merge strategy doesn't require a data migration.
 */
export interface IntentProfile {
  userId: string;
  /** Oldest → newest. Capped (engine bounds the length on write). */
  history: IntentHistoryEntry[];
  /** Epoch ms of the last refine() write. */
  updatedAt: number;
}

export interface ProfileStore {
  get(userId: string): Promise<IntentProfile | null> | IntentProfile | null;
  set(userId: string, profile: IntentProfile): Promise<void> | void;
  /** Optional — useful for "forget me" flows. */
  delete?(userId: string): Promise<void> | void;
}

// ────────────────────────────────────────────────────────────
// Usage telemetry
// ────────────────────────────────────────────────────────────

/** A single interaction event emitted by the client-side collector. */
export interface UsageEvent {
  userId: string;
  schemaName: string;
  /** The ID of the IR that was rendered when this event occurred. */
  irId?: string;
  /** data-fluid-node value — "kanban", "list", "card", "stat" … */
  nodeType: string;
  /** data-fluid-id value from the rendered element. */
  nodeId?: string;
  /** data-fluid-entity value — which entity was being viewed. */
  entity?: string;
  action: "click" | "view" | "scroll" | "expand" | "collapse" | "dismiss";
  device?: "mobile" | "desktop";
  viewportWidth?: number;
  timestamp: number;
}

/** Aggregated view of a user's behaviour over a time window. */
export interface UsageSummary {
  userId: string;
  schemaName: string;
  /** Number of days the window covers. */
  windowDays: number;
  /** Total raw event count in the window. */
  totalEvents: number;
  /**
   * Per-entity interaction share, normalised 0–1.
   * e.g. { Deal: 0.85, Activity: 0.12, Ticket: 0.03 }
   */
  entityAffinities: Record<string, number>;
  /** Node types ranked by interaction frequency. */
  hotNodeTypes: { type: string; entity?: string; count: number }[];
  /**
   * Node types that were rendered (viewed) but never clicked in the window.
   * These are candidates for removal on the next refine().
   */
  coldNodeTypes: { type: string; entity?: string }[];
  /** Inferred from which node type attracted the most interactions. */
  inferredLayout?: "kanban" | "list" | "dashboard" | "split";
  /** Inferred from click-to-view ratio. High ratio → compact. */
  inferredDensity?: "compact" | "comfortable";
  /** Hour-of-day histogram buckets (index = hour 0–23). */
  activeHours: number[];
}

export interface UsageTracker {
  /**
   * Ingest a batch of events. The DB implementation bulk-inserts;
   * the no-op default silently drops them.
   */
  recordBatch(events: UsageEvent[]): Promise<void>;
  /**
   * Compute an aggregated summary for the past `windowDays` days.
   * Returns null when there are not enough events to be meaningful.
   */
  summarize(
    userId: string,
    schemaName: string,
    windowDays?: number,
  ): Promise<UsageSummary | null>;
}

// ────────────────────────────────────────────────────────────
// Context enrichment
// ────────────────────────────────────────────────────────────

/**
 * Environmental signals known to the application layer that the engine
 * should weave into the expanded intent.
 *
 * All fields are optional — the enricher does its best with whatever is
 * present, and produces an empty string when there's nothing useful.
 */
export interface ContextSignals {
  /** Auth-system role — "sales_rep", "manager", "cs", etc. */
  role?: string;
  /** Permission strings. Used to gate sensitive fields in the prompt. */
  permissions?: string[];
  /** Detected client form-factor. */
  device?: "mobile" | "tablet" | "desktop";
  /** IANA timezone string, e.g. "Asia/Kolkata". */
  timezone?: string;
  /**
   * The current user's display name.
   * Injected into the prompt so Claude can resolve "my deals" → owner = name.
   */
  currentUserName?: string;
  /** The route/page the user is on — useful for context-aware defaults. */
  route?: string;
}

/**
 * Converts heterogeneous context signals into a plain-text paragraph that
 * is appended to the expanded intent before the LLM call.
 *
 * Consumers implement this themselves so they can embed app-specific logic
 * (e.g. mapping internal role codes to natural-language descriptions).
 * A ready-to-use reference implementation ships in @fluid/telemetry.
 */
export interface ContextEnricher {
  enrich(input: {
    userId: string;
    profile: IntentProfile;
    usageSummary?: UsageSummary | null;
    contextSignals?: ContextSignals;
  }): Promise<string> | string;
}

// ────────────────────────────────────────────────────────────
// Refresh policy
// ────────────────────────────────────────────────────────────

export interface RefreshDecision {
  refresh: boolean;
  /** Human-readable reason logged and stored in the refresh queue. */
  reason?: string;
}

/**
 * Decides whether a user's active IR is stale enough to warrant
 * background re-generation without an explicit user request.
 *
 * A reference implementation ships in @fluid/telemetry.
 */
export interface RefreshPolicy {
  shouldRefresh(ctx: {
    userId: string;
    /** Epoch ms when the current IR was generated. */
    lastGeneratedAt: number;
    usageSummary: UsageSummary | null;
  }): Promise<RefreshDecision> | RefreshDecision;
}

