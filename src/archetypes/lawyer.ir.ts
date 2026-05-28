import type { FluidIR } from "@/fluid/core";

export const lawyerIR: FluidIR = {
  version: 1,
  archetype: "lawyer",
  schema: "tasks",
  root: {
    type: "stack",
    direction: "col",
    gap: "lg",
    children: [
      { type: "heading", text: "Matters & References", level: 1 },
      {
        type: "split",
        ratio: "2:1",
        left: {
          type: "stack",
          direction: "col",
          gap: "md",
          children: [
            { type: "heading", text: "Tasks by matter", level: 3 },
            {
              type: "list",
              variant: "comfortable",
              groupHeader: true,
              query: { entity: "Task", groupBy: "matter", sortBy: "dueAt" },
              item: {
                type: "card",
                title: { kind: "binding", entity: "Task", field: "title" },
                subtitle: { kind: "binding", entity: "Task", field: "dueAt", format: "relative-date" },
                badges: [
                  { type: "badge", binding: { kind: "binding", entity: "Task", field: "priority", format: "priority" } },
                  { type: "badge", binding: { kind: "binding", entity: "Task", field: "status", format: "badge" }, tone: "neutral" },
                ],
                fields: [
                  { type: "field", binding: { kind: "binding", entity: "Task", field: "assignee" }, label: "Owner" },
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
            { type: "heading", text: "Pinned snippets", level: 3 },
            {
              type: "list",
              variant: "comfortable",
              groupHeader: true,
              query: { entity: "Snippet", groupBy: "matter" },
              item: {
                type: "card",
                title: { kind: "binding", entity: "Snippet", field: "title" },
                subtitle: { kind: "binding", entity: "Snippet", field: "tags" },
                fields: [
                  { type: "field", binding: { kind: "binding", entity: "Snippet", field: "body" } },
                ],
              },
            },
          ],
        },
      },
    ],
  },
};
