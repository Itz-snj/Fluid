import type { IntentProfile, ProfileStore } from "./adapters";

export interface MemoryProfileStoreOptions {
  /** Hard cap on number of distinct users tracked before LRU eviction. */
  maxUsers?: number;
}

/**
 * Default in-memory ProfileStore.
 *
 * Good for dev, demos, and single-instance prod. Dies on restart — for
 * persistence, plug in a Redis / Postgres / Upstash adapter with the same
 * shape. The interface is `get` / `set` / optional `delete` — same idea as
 * CacheAdapter.
 */
export function createMemoryProfileStore(
  opts: MemoryProfileStoreOptions = {},
): ProfileStore {
  const maxUsers = opts.maxUsers ?? 10_000;
  const store = new Map<string, IntentProfile>();

  return {
    get(userId) {
      return store.get(userId) ?? null;
    },
    set(userId, profile) {
      if (store.has(userId)) store.delete(userId);
      store.set(userId, profile);
      while (store.size > maxUsers) {
        const oldest = store.keys().next().value;
        if (oldest === undefined) break;
        store.delete(oldest);
      }
    },
    delete(userId) {
      store.delete(userId);
    },
  };
}
