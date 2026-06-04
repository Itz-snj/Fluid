import type { RefreshDecision, RefreshPolicy, UsageSummary } from "@fluid-genui/engine";

export interface RefreshPolicyOptions {
  /** Refresh if the IR is older than this many days. Default 7. */
  maxAgeDays?: number;
  /**
   * Refresh if this fraction of rendered sections are never interacted with.
   * Default 0.4 (40%).
   */
  coldNodeRatio?: number;
  /**
   * Minimum number of events required before cold-node detection is reliable.
   * Default 20.
   */
  minEventsForColdDetection?: number;
}

/**
 * Reference RefreshPolicy implementation.
 *
 * Triggers a background re-generation when either:
 *   1. The IR is older than `maxAgeDays` — avoids staleness drift.
 *   2. More than `coldNodeRatio` of rendered sections are never interacted
 *      with — layout has drifted from the user's actual usage.
 *
 * Never triggers when `usageSummary` is null or below `minEventsForColdDetection`
 * — avoids re-generating based on insufficient data.
 */
export function createRefreshPolicy(opts: RefreshPolicyOptions = {}): RefreshPolicy {
  const maxAgeDays = opts.maxAgeDays ?? 7;
  const coldNodeRatio = opts.coldNodeRatio ?? 0.4;
  const minEvents = opts.minEventsForColdDetection ?? 20;

  return {
    shouldRefresh({
      lastGeneratedAt,
      usageSummary,
    }: {
      userId: string;
      lastGeneratedAt: number;
      usageSummary: UsageSummary | null;
    }): RefreshDecision {
      // --- Staleness check ---
      const ageDays = (Date.now() - lastGeneratedAt) / (1000 * 60 * 60 * 24);
      if (ageDays > maxAgeDays) {
        return {
          refresh: true,
          reason: `IR is ${Math.floor(ageDays)} days old (threshold: ${maxAgeDays} days)`,
        };
      }

      // --- Cold-node ratio check ---
      if (
        usageSummary &&
        usageSummary.totalEvents >= minEvents
      ) {
        const totalNodes =
          usageSummary.hotNodeTypes.length + usageSummary.coldNodeTypes.length;
        if (totalNodes > 0) {
          const ratio = usageSummary.coldNodeTypes.length / totalNodes;
          if (ratio >= coldNodeRatio) {
            const pct = Math.round(ratio * 100);
            return {
              refresh: true,
              reason: `${pct}% of rendered sections were never interacted with (threshold: ${Math.round(coldNodeRatio * 100)}%)`,
            };
          }
        }
      }

      return { refresh: false };
    },
  };
}
