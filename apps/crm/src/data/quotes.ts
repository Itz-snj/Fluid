import type { Quote } from "../schemas/crm.types";

/** Quotes tied to deals. totalAmount is numeric for stat aggregation. */
export const quotes: Quote[] = [
  { id: "q1", name: "Globex Expansion — Q2 Quote", status: "sent", totalAmount: 320000, validUntil: "2026-06-30", dealId: "d1", dealName: "Globex — Platform Expansion", accountId: "a1", accountName: "Globex Corporation", ownerId: "u1", ownerName: "Ava Reyes", createdAt: "2026-05-20" },
  { id: "q2", name: "Initech Renewal Quote", status: "draft", totalAmount: 88000, validUntil: "2026-07-15", dealId: "d2", dealName: "Initech — Annual Renewal", accountId: "a2", accountName: "Initech Systems", ownerId: "u2", ownerName: "Marcus Webb", createdAt: "2026-05-22" },
  { id: "q3", name: "Hooli Enterprise Quote", status: "sent", totalAmount: 780000, validUntil: "2026-07-20", dealId: "d6", dealName: "Hooli — Enterprise Rollout", accountId: "a6", accountName: "Hooli Finance", ownerId: "u1", ownerName: "Ava Reyes", createdAt: "2026-05-24" },
  { id: "q4", name: "Umbrella POS — Final", status: "accepted", totalAmount: 96000, validUntil: "2026-05-30", dealId: "d5", dealName: "Umbrella — POS Integration", accountId: "a5", accountName: "Umbrella Retail", ownerId: "u3", ownerName: "Priya Nair", createdAt: "2026-05-01" },
  { id: "q5", name: "Nordström Grid Analytics Quote", status: "sent", totalAmount: 410000, validUntil: "2026-07-31", dealId: "d8", dealName: "Nordström — Grid Analytics", accountId: "a9", accountName: "Nordström Energy", ownerId: "u1", ownerName: "Ava Reyes", createdAt: "2026-05-23" },
  { id: "q6", name: "Pied Piper Starter Quote", status: "rejected", totalAmount: 24000, validUntil: "2026-05-01", dealId: "d7", dealName: "Pied Piper — Starter", accountId: "a7", accountName: "Pied Piper", ownerId: "u3", ownerName: "Priya Nair", createdAt: "2026-04-10" },
  { id: "q7", name: "Cyberdyne Security Quote", status: "sent", totalAmount: 215000, validUntil: "2026-06-15", dealId: "d11", dealName: "Cyberdyne — Security Add-on", accountId: "a12", accountName: "Cyberdyne Labs", ownerId: "u1", ownerName: "Ava Reyes", createdAt: "2026-05-26" },
  { id: "q8", name: "Stark R&D Add-on Quote", status: "draft", totalAmount: 175000, validUntil: "2026-08-01", dealId: "d13", dealName: "Stark — R&D Add-on", accountId: "a3", accountName: "Stark Industries", ownerId: "u1", ownerName: "Ava Reyes", createdAt: "2026-05-25" },
  { id: "q9", name: "Maple Content Hub Quote", status: "expired", totalAmount: 38000, validUntil: "2026-05-20", dealId: "d9", dealName: "Maple Media — Content Hub", accountId: "a10", accountName: "Maple Media", ownerId: "u3", ownerName: "Priya Nair", createdAt: "2026-04-22" },
];

export const quoteById = (id: string): Quote | undefined =>
  quotes.find((q) => q.id === id);
