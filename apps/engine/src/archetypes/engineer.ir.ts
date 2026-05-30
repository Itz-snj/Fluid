import type { FluidIR } from "@/fluid/core";

export const engineerIR: FluidIR = {
  version: 1,
  archetype: "engineer",
  schema: "tasks",
  root: {
    type: "stack",
    direction: "col",
    gap: "lg",
    children: [
      { type: "heading", text: "Engineering board", level: 1 },
      {
        type: "kanban",
        query: { entity: "Task", sortBy: "priority" },
        groupBy: "status",
        columns: ["backlog", "in_progress", "review", "done"],
        card: {
          type: "card",
          title: { kind: "binding", entity: "Task", field: "title" },
          subtitle: { kind: "binding", entity: "Task", field: "matter" },
          badges: [
            { type: "badge", binding: { kind: "binding", entity: "Task", field: "priority", format: "priority" } },
            { type: "badge", binding: { kind: "binding", entity: "Task", field: "assignee" }, tone: "info" },
          ],
          fields: [
            { type: "field", binding: { kind: "binding", entity: "Task", field: "dueAt", format: "relative-date" }, label: "Due" },
          ],
        },
      },
    ],
  },
};
