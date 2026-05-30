import type { FluidIR } from "@fluid/core";

/**
 * Sales Manager — team performance dashboard.
 *
 * High-level stats (pipeline by rep, won revenue, conversion), a deal list
 * grouped by owner, and a lead funnel view. Demonstrates: grid+stat with
 * countWhere, list with groupHeader, split layout.
 */
export const salesManagerIR: FluidIR = {
  version: 1,
  archetype: "sales_manager",
  schema: "crm",
  root: {
    type: "stack",
    direction: "col",
    gap: "lg",
    children: [
      { type: "heading", text: "Sales Team Dashboard", level: 1 },
      {
        type: "grid",
        cols: 4,
        children: [
          { type: "stat", label: "Total Pipeline", query: { entity: "Deal" }, aggregate: "sum", field: "amount" },
          { type: "stat", label: "Won Revenue", query: { entity: "Deal", filter: { field: "stage", op: "eq", value: "closed_won" } }, aggregate: "sum", field: "amount" },
          { type: "stat", label: "Hot Leads", query: { entity: "Lead" }, aggregate: "countWhere", whereField: "rating", whereValue: "hot" },
          { type: "stat", label: "Open Cases", query: { entity: "Case" }, aggregate: "countWhere", whereField: "status", whereValue: "escalated" },
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
            { type: "heading", text: "Deals by Owner", level: 2 },
            {
              type: "list",
              query: { entity: "Deal", groupBy: "ownerName", sortBy: "amount" },
              variant: "comfortable",
              groupHeader: true,
              item: {
                type: "card",
                title: { kind: "binding", entity: "Deal", field: "name" },
                subtitle: { kind: "binding", entity: "Deal", field: "accountName" },
                badges: [
                  { type: "badge", binding: { kind: "binding", entity: "Deal", field: "stage", format: "badge" }, tone: "info" },
                  { type: "badge", binding: { kind: "binding", entity: "Deal", field: "amount" }, tone: "success" },
                ],
                fields: [
                  { type: "field", binding: { kind: "binding", entity: "Deal", field: "closeDate", format: "date" }, label: "Close" },
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
            { type: "heading", text: "Lead Funnel", level: 2 },
            {
              type: "grid",
              cols: 2,
              children: [
                { type: "stat", label: "New", query: { entity: "Lead" }, aggregate: "countWhere", whereField: "status", whereValue: "new" },
                { type: "stat", label: "Contacted", query: { entity: "Lead" }, aggregate: "countWhere", whereField: "status", whereValue: "contacted" },
                { type: "stat", label: "Qualified", query: { entity: "Lead" }, aggregate: "countWhere", whereField: "status", whereValue: "qualified" },
                { type: "stat", label: "Converted", query: { entity: "Lead" }, aggregate: "countWhere", whereField: "status", whereValue: "converted" },
              ],
            },
            {
              type: "list",
              query: { entity: "Lead", filter: { field: "rating", op: "eq", value: "hot" }, sortBy: "estimatedValue", limit: 5 },
              variant: "compact",
              emptyText: "No hot leads.",
              item: {
                type: "card",
                title: { kind: "binding", entity: "Lead", field: "name" },
                subtitle: { kind: "binding", entity: "Lead", field: "company" },
                badges: [
                  { type: "badge", binding: { kind: "binding", entity: "Lead", field: "rating", format: "priority" }, tone: "danger" },
                  { type: "badge", binding: { kind: "binding", entity: "Lead", field: "source" }, tone: "neutral" },
                ],
                fields: [
                  { type: "field", binding: { kind: "binding", entity: "Lead", field: "estimatedValue" }, label: "Est. Value" },
                ],
                actions: [
                  { type: "action", label: "Convert", mutation: "convertLead", args: { id: { kind: "binding", entity: "Lead", field: "id" } }, style: "primary", confirmText: "Convert this lead to an account and deal?" },
                ],
              },
            },
          ],
        },
      },
    ],
  },
};
