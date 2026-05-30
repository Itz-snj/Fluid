import type { FluidIR } from "@fluid/core";
import { lawyerIR } from "./lawyer.ir";
import { engineerIR } from "./engineer.ir";
import { pmIR } from "./pm.ir";

export interface ArchetypeMeta {
  id: string;
  label: string;
  emoji: string;
  intent: string;
  ir: FluidIR;
}

export const archetypes: ArchetypeMeta[] = [
  {
    id: "lawyer",
    label: "Lawyer",
    emoji: "⚖️",
    intent: "Tasks grouped by matter, law snippets pinned beside them.",
    ir: lawyerIR,
  },
  {
    id: "engineer",
    label: "Engineer",
    emoji: "⚙️",
    intent: "Kanban by status, compact cards, see who owns what.",
    ir: engineerIR,
  },
  {
    id: "pm",
    label: "PM",
    emoji: "📋",
    intent: "High-level status across projects, then drill down.",
    ir: pmIR,
  },
];

export function getArchetype(id: string): ArchetypeMeta {
  return archetypes.find((a) => a.id === id) ?? archetypes[0];
}
