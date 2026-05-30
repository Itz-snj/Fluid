/**
 * Suggestion Generator — converts UsageSummary data into
 * proactive suggestions for the chatbot widget.
 *
 * This is a pure function with no database dependency.
 * It takes a usage summary and produces an array of suggestion candidates
 * that should be inserted into the `fluid_suggestions` table.
 */

export interface SuggestionCandidate {
  type: "remove_cold" | "promote_hot" | "layout_change" | "density_change";
  message: string;
  proposedIntent: string;
}

export interface UsageSummaryInput {
  totalEvents: number;
  entityAffinities: Record<string, number>;
  hotNodeTypes: { type: string; entity?: string; count: number }[];
  coldNodeTypes: { type: string; entity?: string }[];
  inferredLayout?: string;
  inferredDensity?: string;
}

export interface SuggestionGeneratorOptions {
  /** Minimum number of events before generating suggestions. Default: 20 */
  minEvents?: number;
  /** Cold node threshold — fraction of nodes that must be cold to trigger. Default: 0.4 */
  coldThreshold?: number;
  /** Hot affinity threshold — single entity must be above this to trigger. Default: 0.8 */
  hotAffinityThreshold?: number;
}

/**
 * Generate suggestion candidates from a usage summary.
 *
 * Returns 0-4 candidates. Callers should deduplicate against
 * existing pending suggestions before inserting.
 */
export function generateSuggestions(
  summary: UsageSummaryInput,
  currentLayout?: string,
  currentDensity?: string,
  opts: SuggestionGeneratorOptions = {},
): SuggestionCandidate[] {
  const {
    minEvents = 20,
    coldThreshold = 0.4,
    hotAffinityThreshold = 0.8,
  } = opts;

  // Don't suggest anything until we have enough data.
  if (summary.totalEvents < minEvents) return [];

  const candidates: SuggestionCandidate[] = [];

  // 1. Cold node removal — too many sections the user never touches.
  if (summary.coldNodeTypes.length > 0) {
    const totalNodes = summary.hotNodeTypes.length + summary.coldNodeTypes.length;
    const coldRatio = totalNodes > 0 ? summary.coldNodeTypes.length / totalNodes : 0;

    if (coldRatio >= coldThreshold) {
      const coldNames = summary.coldNodeTypes
        .map((n) => n.entity || n.type)
        .slice(0, 3)
        .join(", ");

      candidates.push({
        type: "remove_cold",
        message: `You rarely interact with the ${coldNames} section${summary.coldNodeTypes.length > 1 ? "s" : ""}. Remove ${summary.coldNodeTypes.length > 1 ? "them" : "it"} for a cleaner layout?`,
        proposedIntent: `Remove the following sections from the layout: ${coldNames}. Keep everything else the same.`,
      });
    }
  }

  // 2. Hot entity promotion — one entity dominates usage.
  const affinityEntries = Object.entries(summary.entityAffinities);
  const topEntity = affinityEntries.sort((a, b) => b[1] - a[1])[0];
  if (topEntity && topEntity[1] >= hotAffinityThreshold) {
    candidates.push({
      type: "promote_hot",
      message: `You spend most of your time on ${topEntity[0]} (${Math.round(topEntity[1] * 100)}% of interactions). Make it the primary section?`,
      proposedIntent: `Make the ${topEntity[0]} section the primary focus of the layout. Move it to the top and give it more visual space. Keep other sections but make them secondary.`,
    });
  }

  // 3. Layout change — inferred layout differs from current.
  if (
    summary.inferredLayout &&
    currentLayout &&
    summary.inferredLayout !== currentLayout
  ) {
    candidates.push({
      type: "layout_change",
      message: `Based on your usage, a "${summary.inferredLayout}" layout might work better than the current "${currentLayout}" layout. Switch?`,
      proposedIntent: `Change the main layout style to ${summary.inferredLayout}. Reorganize the sections to best fit this layout pattern while keeping all the same data.`,
    });
  }

  // 4. Density change — inferred density differs from current.
  if (
    summary.inferredDensity &&
    currentDensity &&
    summary.inferredDensity !== currentDensity
  ) {
    candidates.push({
      type: "density_change",
      message: `You seem to prefer "${summary.inferredDensity}" views. Switch all lists to "${summary.inferredDensity}" mode?`,
      proposedIntent: `Change all list variants to "${summary.inferredDensity}". Keep the same data and layout structure.`,
    });
  }

  return candidates;
}
