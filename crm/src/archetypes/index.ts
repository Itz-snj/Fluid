import type { FluidIR } from "@fluid/core";
import { salesRepIR } from "./sales-rep.ir";
import { salesManagerIR } from "./sales-manager.ir";
import { supportAgentIR } from "./support-agent.ir";

export interface ArchetypeMeta {
  id: string;
  label: string;
  emoji: string;
  intent: string;
  ir: FluidIR;
}

/**
 * Preset CRM archetypes. They serve three roles (see ARCHITECTURE.md):
 *   1. Demo evidence — radically different layouts from one schema + data.
 *   2. Cold-start fallbacks — what a brand-new user sees before any history.
 *   3. Grammar regression fixtures — validated by scripts/smoke.ts on CI.
 */
export const archetypes: ArchetypeMeta[] = [
  {
    id: "sales_rep",
    label: "Sales Rep",
    emoji: "💼",
    intent: "My pipeline as a kanban by stage, upcoming activities beside it.",
    ir: salesRepIR,
  },
  {
    id: "sales_manager",
    label: "Sales Manager",
    emoji: "📊",
    intent: "Team dashboard — pipeline by rep, won revenue, lead funnel.",
    ir: salesManagerIR,
  },
  {
    id: "support_agent",
    label: "Support Agent",
    emoji: "🎧",
    intent: "Case queue as a kanban by status, escalate and close inline.",
    ir: supportAgentIR,
  },
];

export function getArchetype(id: string): ArchetypeMeta {
  return archetypes.find((a) => a.id === id) ?? archetypes[0];
}
