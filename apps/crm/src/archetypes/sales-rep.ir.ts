import type { FluidIR } from "@fluid/core";

/**
 * Sales Rep — pipeline-first workspace.
 *
 * Top KPI row (open pipeline value, won deals, open activities), a deal kanban
 * by stage with action buttons, and a side panel of upcoming activities.
 * Demonstrates: grid+stat, kanban with card actions, split, list.
 */
export const salesRepIR: FluidIR = {
  version: 1,
  archetype: "sales_rep",
  schema: "crm",
  root: {
    type: "stack",
    direction: "col",
    gap: "lg",
    children: [
      { type: "heading", text: "My Sales Pipeline", level: 1 },
      {
        type: "grid",
        cols: 3,
        children: [
          { type: "stat", label: "Open Pipeline", query: { entity: "Deal" }, aggregate: "sum", field: "amount" },
          { type: "stat", label: "Total Deals", query: { entity: "Deal" }, aggregate: "count" },
          { type: "stat", label: "Open Activities", query: { entity: "Activity" }, aggregate: "countWhere", whereField: "status", whereValue: "open" },
        ],
      },
      {
        type: "split",
        ratio: "2:1",
        left: {
          type: "kanban",
          query: { entity: "Deal", sortBy: "amount" },
          groupBy: "stage",
          columns: ["prospecting", "qualification", "proposal", "negotiation", "closed_won", "closed_lost"],
          card: {
            type: "card",
            title: { kind: "binding", entity: "Deal", field: "name" },
            subtitle: { kind: "binding", entity: "Deal", field: "accountName" },
            badges: [
              { type: "badge", binding: { kind: "binding", entity: "Deal", field: "amount" }, tone: "success" },
              { type: "badge", binding: { kind: "binding", entity: "Deal", field: "type" }, tone: "info" },
            ],
            fields: [
              { type: "field", binding: { kind: "binding", entity: "Deal", field: "closeDate", format: "date" }, label: "Close" },
              { type: "field", binding: { kind: "binding", entity: "Deal", field: "ownerName" }, label: "Owner" },
            ],
            actions: [
              { type: "action", label: "Advance", mutation: "advanceDealStage", args: { id: { kind: "binding", entity: "Deal", field: "id" } }, style: "primary" },
              { type: "action", label: "Won", mutation: "closeDealWon", args: { id: { kind: "binding", entity: "Deal", field: "id" } }, style: "secondary", confirmText: "Mark this deal as won?" },
            ],
          },
        },
        right: {
          type: "stack",
          direction: "col",
          gap: "md",
          children: [
            { type: "heading", text: "Upcoming Activities", level: 2 },
            {
              type: "list",
              query: { entity: "Activity", filter: { field: "status", op: "eq", value: "open" }, sortBy: "dueAt" },
              variant: "compact",
              emptyText: "No open activities.",
              item: {
                type: "card",
                title: { kind: "binding", entity: "Activity", field: "subject" },
                subtitle: { kind: "binding", entity: "Activity", field: "relatedName" },
                badges: [
                  { type: "badge", binding: { kind: "binding", entity: "Activity", field: "priority", format: "priority" } },
                  { type: "badge", binding: { kind: "binding", entity: "Activity", field: "type" }, tone: "neutral" },
                ],
                fields: [
                  { type: "field", binding: { kind: "binding", entity: "Activity", field: "dueAt", format: "relative-date" }, label: "Due" },
                ],
                actions: [
                  { type: "action", label: "Complete", mutation: "completeActivity", args: { id: { kind: "binding", entity: "Activity", field: "id" } }, style: "primary" },
                ],
              },
            },
          ],
        },
      },
    ],
  },
};
