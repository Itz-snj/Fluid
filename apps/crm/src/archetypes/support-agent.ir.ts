import type { FluidIR } from "@fluid/core";

/**
 * Support Agent — ticket queue workspace.
 *
 * Case kanban by status with escalate/close actions, stats for open/escalated
 * cases, and a side panel of recent activities on cases. Demonstrates: kanban
 * with actions, countWhere stats, filtered list.
 */
export const supportAgentIR: FluidIR = {
  version: 1,
  archetype: "support_agent",
  schema: "crm",
  root: {
    type: "stack",
    direction: "col",
    gap: "lg",
    children: [
      { type: "heading", text: "Support Queue", level: 1 },
      {
        type: "grid",
        cols: 4,
        children: [
          { type: "stat", label: "Open Cases", query: { entity: "Case" }, aggregate: "countWhere", whereField: "status", whereValue: "new" },
          { type: "stat", label: "In Progress", query: { entity: "Case" }, aggregate: "countWhere", whereField: "status", whereValue: "in_progress" },
          { type: "stat", label: "Escalated", query: { entity: "Case" }, aggregate: "countWhere", whereField: "status", whereValue: "escalated" },
          { type: "stat", label: "Closed Today", query: { entity: "Case" }, aggregate: "countWhere", whereField: "status", whereValue: "closed" },
        ],
      },
      {
        type: "split",
        ratio: "2:1",
        left: {
          type: "kanban",
          query: { entity: "Case", sortBy: "priority" },
          groupBy: "status",
          columns: ["new", "in_progress", "waiting", "escalated", "closed"],
          card: {
            type: "card",
            title: { kind: "binding", entity: "Case", field: "subject" },
            subtitle: { kind: "binding", entity: "Case", field: "accountName" },
            badges: [
              { type: "badge", binding: { kind: "binding", entity: "Case", field: "priority", format: "priority" }, tone: "danger" },
              { type: "badge", binding: { kind: "binding", entity: "Case", field: "type" }, tone: "neutral" },
              { type: "badge", binding: { kind: "binding", entity: "Case", field: "origin" }, tone: "info" },
            ],
            fields: [
              { type: "field", binding: { kind: "binding", entity: "Case", field: "contactName" }, label: "Contact" },
              { type: "field", binding: { kind: "binding", entity: "Case", field: "createdAt", format: "relative-date" }, label: "Opened" },
            ],
            actions: [
              { type: "action", label: "Escalate", mutation: "escalateCase", args: { id: { kind: "binding", entity: "Case", field: "id" } }, style: "danger", confirmText: "Escalate this case to urgent?" },
              { type: "action", label: "Close", mutation: "closeCase", args: { id: { kind: "binding", entity: "Case", field: "id" } }, style: "secondary" },
            ],
          },
        },
        right: {
          type: "stack",
          direction: "col",
          gap: "md",
          children: [
            { type: "heading", text: "My Activities", level: 2 },
            {
              type: "list",
              query: { entity: "Activity", filter: { field: "status", op: "eq", value: "open" }, sortBy: "dueAt", limit: 8 },
              variant: "compact",
              emptyText: "No pending activities.",
              item: {
                type: "card",
                title: { kind: "binding", entity: "Activity", field: "subject" },
                subtitle: { kind: "binding", entity: "Activity", field: "relatedName" },
                badges: [
                  { type: "badge", binding: { kind: "binding", entity: "Activity", field: "type" }, tone: "neutral" },
                ],
                fields: [
                  { type: "field", binding: { kind: "binding", entity: "Activity", field: "dueAt", format: "relative-date" }, label: "Due" },
                ],
                actions: [
                  { type: "action", label: "Done", mutation: "completeActivity", args: { id: { kind: "binding", entity: "Activity", field: "id" } }, style: "primary" },
                ],
              },
            },
          ],
        },
      },
    ],
  },
};
