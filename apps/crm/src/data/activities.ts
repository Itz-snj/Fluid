import type { Activity } from "../schemas/crm.types";

/**
 * Calls, emails, meetings, and tasks. Polymorphic relation via
 * (relatedKind, relatedId, relatedName) — the renderer reads relatedName.
 */
export const activities: Activity[] = [
  { id: "ac1", subject: "Discovery call with Hooli", type: "call", status: "completed", priority: "high", dueAt: "2026-05-20", relatedKind: "Deal", relatedId: "d6", relatedName: "Hooli — Enterprise Rollout", ownerId: "u1", ownerName: "Ava Reyes", completedAt: "2026-05-20", createdAt: "2026-05-15" },
  { id: "ac2", subject: "Send proposal to Initech", type: "email", status: "completed", priority: "normal", dueAt: "2026-05-22", relatedKind: "Deal", relatedId: "d2", relatedName: "Initech — Annual Renewal", ownerId: "u2", ownerName: "Marcus Webb", completedAt: "2026-05-22", createdAt: "2026-05-18" },
  { id: "ac3", subject: "Demo for Stark R&D team", type: "meeting", status: "open", priority: "high", dueAt: "2026-06-03", relatedKind: "Deal", relatedId: "d13", relatedName: "Stark — R&D Add-on", ownerId: "u1", ownerName: "Ava Reyes", completedAt: "", createdAt: "2026-05-24" },
  { id: "ac4", subject: "Follow up with Mei Lin", type: "call", status: "open", priority: "urgent", dueAt: "2026-05-30", relatedKind: "Lead", relatedId: "l2", relatedName: "Mei Lin", ownerId: "u2", ownerName: "Marcus Webb", completedAt: "", createdAt: "2026-05-23" },
  { id: "ac5", subject: "Contract review — Cyberdyne", type: "task", status: "open", priority: "high", dueAt: "2026-06-02", relatedKind: "Deal", relatedId: "d11", relatedName: "Cyberdyne — Security Add-on", ownerId: "u1", ownerName: "Ava Reyes", completedAt: "", createdAt: "2026-05-26" },
  { id: "ac6", subject: "Quarterly check-in — Globex", type: "meeting", status: "open", priority: "normal", dueAt: "2026-06-10", relatedKind: "Account", relatedId: "a1", relatedName: "Globex Corporation", ownerId: "u1", ownerName: "Ava Reyes", completedAt: "", createdAt: "2026-05-25" },
  { id: "ac7", subject: "Qualify Brightpath EdTech", type: "call", status: "completed", priority: "normal", dueAt: "2026-05-19", relatedKind: "Lead", relatedId: "l3", relatedName: "Omar Haddad", ownerId: "u3", ownerName: "Priya Nair", completedAt: "2026-05-19", createdAt: "2026-05-12" },
  { id: "ac8", subject: "Send pricing to Nordström", type: "email", status: "open", priority: "high", dueAt: "2026-05-31", relatedKind: "Deal", relatedId: "d8", relatedName: "Nordström — Grid Analytics", ownerId: "u1", ownerName: "Ava Reyes", completedAt: "", createdAt: "2026-05-23" },
  { id: "ac9", subject: "Onboarding kickoff — Umbrella", type: "meeting", status: "completed", priority: "normal", dueAt: "2026-05-15", relatedKind: "Account", relatedId: "a5", relatedName: "Umbrella Retail", ownerId: "u3", ownerName: "Priya Nair", completedAt: "2026-05-15", createdAt: "2026-05-10" },
  { id: "ac10", subject: "Cold outreach — Crescent Bank", type: "email", status: "open", priority: "normal", dueAt: "2026-05-29", relatedKind: "Lead", relatedId: "l8", relatedName: "Fatima Noor", ownerId: "u2", ownerName: "Marcus Webb", completedAt: "", createdAt: "2026-05-24" },
  { id: "ac11", subject: "Escalation sync — Cyberdyne case", type: "meeting", status: "open", priority: "urgent", dueAt: "2026-05-30", relatedKind: "Case", relatedId: "k3", relatedName: "Data sync failing intermittently", ownerId: "u6", ownerName: "Tom Becker", completedAt: "", createdAt: "2026-05-27" },
  { id: "ac12", subject: "Prep renewal deck — Initech", type: "task", status: "cancelled", priority: "low", dueAt: "2026-05-21", relatedKind: "Deal", relatedId: "d2", relatedName: "Initech — Annual Renewal", ownerId: "u2", ownerName: "Marcus Webb", completedAt: "", createdAt: "2026-05-16" },
  { id: "ac13", subject: "Check in on Acme automation needs", type: "call", status: "open", priority: "low", dueAt: "2026-06-05", relatedKind: "Deal", relatedId: "d10", relatedName: "Acme — Automation License", ownerId: "u2", ownerName: "Marcus Webb", completedAt: "", createdAt: "2026-05-19" },
  { id: "ac14", subject: "Resolve login issue — Maple Media", type: "task", status: "completed", priority: "high", dueAt: "2026-05-18", relatedKind: "Case", relatedId: "k5", relatedName: "SSO login redirect loop", ownerId: "u7", ownerName: "Yuki Tanaka", completedAt: "2026-05-18", createdAt: "2026-05-16" },
];

export const activityById = (id: string): Activity | undefined =>
  activities.find((a) => a.id === id);
