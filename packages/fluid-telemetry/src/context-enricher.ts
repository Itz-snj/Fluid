import type { ContextEnricher, ContextSignals, IntentProfile, UsageSummary } from "@fluid-genui/engine";

/**
 * Reference ContextEnricher implementation.
 *
 * Translates role/device/permissions/time-of-day/user-name signals into a
 * natural-language paragraph that gets appended to the expanded intent.
 *
 * Consumers may use this directly or swap in their own implementation
 * (e.g. to map internal role codes to custom descriptions).
 */
export function createContextEnricher(): ContextEnricher {
  return {
    enrich({
      profile: _profile,
      usageSummary: _summary,
      contextSignals,
    }: {
      userId: string;
      profile: IntentProfile;
      usageSummary?: UsageSummary | null;
      contextSignals?: ContextSignals;
    }): string {
      if (!contextSignals) return "";
      const parts: string[] = [];

      // ── Role → natural language ───────────────────────────
      if (contextSignals.role) {
        const roleDescriptions: Record<string, string> = {
          sales_rep:     "Focus on personal deals and pipeline. Prioritise next actions and close dates.",
          sales_manager: "Show team-level metrics, forecasts, and deal distribution across the team.",
          manager:       "Show team-level metrics, forecasts, and deal distribution across the team.",
          cs:            "Focus on post-close relationships: health scores, renewals, and open tickets.",
          engineer:      "Show tasks grouped by component. Prioritise blockers and in-progress items.",
          designer:      "Show tasks grouped by project/client. Surface creative briefs and review status.",
          exec:          "High-level overview only: key metrics, critical blockers, this week's milestones.",
          support:       "Show open tickets sorted by priority. Highlight overdue and SLA-breached items.",
        };
        const desc = roleDescriptions[contextSignals.role] ?? `Role: ${contextSignals.role}.`;
        parts.push(desc);
      }

      // ── Permissions → field restrictions ──────────────────
      if (contextSignals.permissions) {
        const p = contextSignals.permissions;
        if (!p.includes("view_revenue") && !p.includes("admin")) {
          parts.push("Do not show monetary values, revenue figures, or deal values — user lacks the required permission.");
        }
      }

      // ── Device → layout hints ─────────────────────────────
      if (contextSignals.device === "mobile") {
        parts.push("Mobile device: use single-column layouts with larger touch targets. Avoid side panels and multi-column grids.");
      } else if (contextSignals.device === "tablet") {
        parts.push("Tablet device: two-column layouts are acceptable. Avoid dense four-column grids.");
      }

      // ── Time of day → priority hints ──────────────────────
      const hour = new Date().getHours();
      if (hour >= 7 && hour < 11) {
        parts.push("Morning session: highlight tasks due today and anything flagged as urgent since yesterday.");
      } else if (hour >= 17 && hour < 22) {
        parts.push("End-of-day session: show a summary/status view. De-emphasise action items, surface progress and completions.");
      }

      // ── Current user name → possessive filter resolution ──
      if (contextSignals.currentUserName) {
        parts.push(
          `The current user's display name is "${contextSignals.currentUserName}". ` +
          `When the user says "my" or "I own", filter by owner/assignee equal to this name.`,
        );
      }

      return parts.join(" ");
    },
  };
}
