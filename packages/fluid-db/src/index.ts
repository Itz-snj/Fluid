/**
 * @fluid/db — PostgreSQL-backed adapter implementations for @fluid/engine.
 *
 * Usage:
 *   import { createDbConnection } from "@fluid/db";
 *   import { createPgProfileStore, createPgCacheAdapter, createPgUsageTracker } from "@fluid/db";
 *   import { enqueueRefreshJob, dequeueRefreshJobs, completeRefreshJob } from "@fluid/db";
 *   import { createSnapshot, getActiveSnapshot, revertToSnapshot } from "@fluid/db";
 *   import { appendMessage, getMessages } from "@fluid/db";
 *   import { insertSuggestion, getPendingSuggestions, resolveSuggestion } from "@fluid/db";
 */

export { createDbConnection } from "./connection";
export type { FluidDb } from "./connection";

export * from "./schema";

export { createPgProfileStore, upsertUserContext } from "./profile-store";
export { createPgCacheAdapter } from "./cache-adapter";
export { createPgUsageTracker } from "./usage-tracker";
export {
  enqueueRefreshJob,
  dequeueRefreshJobs,
  completeRefreshJob,
  pendingRefreshCount,
} from "./refresh-queue";

// ── Chatbot stores ──
export {
  createSnapshot,
  getActiveSnapshot,
  getSnapshot,
  getSnapshotHistory,
  revertToSnapshot,
} from "./ir-snapshot-store";
export type { IRSnapshot, SnapshotSource } from "./ir-snapshot-store";

export {
  appendMessage,
  getMessages,
  markApplied,
} from "./chat-store";
export type { ChatMessage } from "./chat-store";

export {
  insertSuggestion,
  getPendingSuggestions,
  resolveSuggestion,
} from "./suggestion-store";
export type { Suggestion } from "./suggestion-store";

