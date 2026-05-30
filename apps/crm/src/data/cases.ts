import type { Case } from "../schemas/crm.types";

/** Support tickets. Drives the support-agent archetype (kanban by status). */
export const cases: Case[] = [
  { id: "k1", subject: "API rate limits too aggressive", status: "in_progress", priority: "high", type: "problem", origin: "email", accountId: "a1", accountName: "Globex Corporation", contactId: "c1", contactName: "Hank Scorpio", ownerId: "u6", ownerName: "Tom Becker", createdAt: "2026-05-22", closedAt: "" },
  { id: "k2", subject: "How to configure SSO with Okta?", status: "waiting", priority: "normal", type: "question", origin: "web", accountId: "a2", accountName: "Initech Systems", contactId: "c3", contactName: "Bill Lumbergh", ownerId: "u7", ownerName: "Yuki Tanaka", createdAt: "2026-05-24", closedAt: "" },
  { id: "k3", subject: "Data sync failing intermittently", status: "escalated", priority: "urgent", type: "incident", origin: "phone", accountId: "a12", accountName: "Cyberdyne Labs", contactId: "c13", contactName: "Sarah Connor", ownerId: "u6", ownerName: "Tom Becker", createdAt: "2026-05-25", closedAt: "" },
  { id: "k4", subject: "Request: bulk export to CSV", status: "new", priority: "low", type: "feature_request", origin: "web", accountId: "a3", accountName: "Stark Industries", contactId: "c4", contactName: "Pepper Potts", ownerId: "u7", ownerName: "Yuki Tanaka", createdAt: "2026-05-27", closedAt: "" },
  { id: "k5", subject: "SSO login redirect loop", status: "closed", priority: "high", type: "problem", origin: "chat", accountId: "a10", accountName: "Maple Media", contactId: "c11", contactName: "Nadia Khan", ownerId: "u7", ownerName: "Yuki Tanaka", createdAt: "2026-05-14", closedAt: "2026-05-18" },
  { id: "k6", subject: "Dashboard loading slowly", status: "in_progress", priority: "normal", type: "problem", origin: "email", accountId: "a9", accountName: "Nordström Energy", contactId: "c10", contactName: "Erik Lund", ownerId: "u6", ownerName: "Tom Becker", createdAt: "2026-05-23", closedAt: "" },
  { id: "k7", subject: "Billing discrepancy on May invoice", status: "waiting", priority: "high", type: "problem", origin: "email", accountId: "a5", accountName: "Umbrella Retail", contactId: "c7", contactName: "Alice Wong", ownerId: "u7", ownerName: "Yuki Tanaka", createdAt: "2026-05-26", closedAt: "" },
  { id: "k8", subject: "Webhook payload missing fields", status: "escalated", priority: "urgent", type: "incident", origin: "web", accountId: "a1", accountName: "Globex Corporation", contactId: "c2", contactName: "Carol Danvers", ownerId: "u6", ownerName: "Tom Becker", createdAt: "2026-05-28", closedAt: "" },
  { id: "k9", subject: "Feature: dark mode in reports", status: "new", priority: "low", type: "feature_request", origin: "chat", accountId: "a12", accountName: "Cyberdyne Labs", contactId: "c14", contactName: "Miles Dyson", ownerId: "u7", ownerName: "Yuki Tanaka", createdAt: "2026-05-29", closedAt: "" },
  { id: "k10", subject: "Mobile app crashes on launch", status: "closed", priority: "urgent", type: "incident", origin: "phone", accountId: "a3", accountName: "Stark Industries", contactId: "c5", contactName: "Bruce Banner", ownerId: "u6", ownerName: "Tom Becker", createdAt: "2026-05-10", closedAt: "2026-05-13" },
];

export const caseById = (id: string): Case | undefined =>
  cases.find((k) => k.id === id);
