import type { FluidIR } from "@/fluid/core";

export const pmIR: FluidIR = {
  version: 1,
  archetype: "pm",
  schema: "tasks",
  root: {
    type: "stack",
    direction: "col",
    gap: "lg",
    children: [
      { type: "heading", text: "Portfolio overview", level: 1 },
      {
        type: "grid",
        cols: 4,
        children: [
          { type: "stat", label: "Total tasks", query: { entity: "Task" }, aggregate: "count" },
          { type: "stat", label: "In progress", query: { entity: "Task" }, aggregate: "countWhere", whereField: "status", whereValue: "in_progress" },
          { type: "stat", label: "P0 open", query: { entity: "Task", filter: { field: "status", op: "neq", value: "done" } }, aggregate: "countWhere", whereField: "priority", whereValue: "p0" },
          { type: "stat", label: "Awaiting review", query: { entity: "Task" }, aggregate: "countWhere", whereField: "status", whereValue: "review" },
        ],
      },
      {
        type: "split",
        ratio: "1:1",
        left: {
          type: "stack",
          direction: "col",
          gap: "md",
          children: [
            { type: "heading", text: "High priority across matters", level: 3 },
            {
              type: "list",
              variant: "compact",
              query: { entity: "Task", filter: { field: "priority", op: "in", value: ["p0", "p1"] }, sortBy: "dueAt" },
              item: {
                type: "card",
                title: { kind: "binding", entity: "Task", field: "title" },
                subtitle: { kind: "binding", entity: "Task", field: "matter" },
                badges: [
                  { type: "badge", binding: { kind: "binding", entity: "Task", field: "priority", format: "priority" } },
                  { type: "badge", binding: { kind: "binding", entity: "Task", field: "status", format: "badge" }, tone: "neutral" },
                ],
              },
            },
          ],
        },
        right: {
          type: "stack",
          direction: "col",
          gap: "md",
          children: [
            { type: "heading", text: "By matter", level: 3 },
            {
              type: "list",
              variant: "compact",
              groupHeader: true,
              query: { entity: "Task", groupBy: "matter" },
              item: {
                type: "card",
                title: { kind: "binding", entity: "Task", field: "title" },
                badges: [
                  { type: "badge", binding: { kind: "binding", entity: "Task", field: "status", format: "badge" }, tone: "neutral" },
                ],
              },
            },
          ],
        },
      },
    ],
  },
};
