import type { Deal } from "../schemas/crm.types";

/**
 * Open + closed opportunities. `amount` and `probability` are numeric so the
 * IR `stat` node can `sum` / aggregate them. Stages drive the kanban archetype.
 */
export const deals: Deal[] = [
  { id: "d1", name: "Globex — Platform Expansion", stage: "negotiation", type: "expansion", amount: 320000, probability: 75, source: "referral", accountId: "a1", accountName: "Globex Corporation", ownerId: "u1", ownerName: "Ava Reyes", closeDate: "2026-06-15", createdAt: "2026-03-01", updatedAt: "2026-05-26" },
  { id: "d2", name: "Initech — Annual Renewal", stage: "proposal", type: "renewal", amount: 88000, probability: 60, source: "web", accountId: "a2", accountName: "Initech Systems", ownerId: "u2", ownerName: "Marcus Webb", closeDate: "2026-06-30", createdAt: "2026-04-02", updatedAt: "2026-05-24" },
  { id: "d3", name: "Stark — Manufacturing Suite", stage: "qualification", type: "new_business", amount: 540000, probability: 40, source: "event", accountId: "a3", accountName: "Stark Industries", ownerId: "u1", ownerName: "Ava Reyes", closeDate: "2026-08-01", createdAt: "2026-04-20", updatedAt: "2026-05-25" },
  { id: "d4", name: "Wayne Health — Pilot", stage: "prospecting", type: "new_business", amount: 150000, probability: 20, source: "cold_call", accountId: "a4", accountName: "Wayne Health", ownerId: "u2", ownerName: "Marcus Webb", closeDate: "2026-09-15", createdAt: "2026-05-05", updatedAt: "2026-05-20" },
  { id: "d5", name: "Umbrella — POS Integration", stage: "closed_won", type: "new_business", amount: 96000, probability: 100, source: "partner", accountId: "a5", accountName: "Umbrella Retail", ownerId: "u3", ownerName: "Priya Nair", closeDate: "2026-05-12", createdAt: "2026-02-15", updatedAt: "2026-05-12" },
  { id: "d6", name: "Hooli — Enterprise Rollout", stage: "negotiation", type: "new_business", amount: 780000, probability: 70, source: "event", accountId: "a6", accountName: "Hooli Finance", ownerId: "u1", ownerName: "Ava Reyes", closeDate: "2026-07-10", createdAt: "2026-03-18", updatedAt: "2026-05-27" },
  { id: "d7", name: "Pied Piper — Starter", stage: "closed_lost", type: "new_business", amount: 24000, probability: 0, source: "web", accountId: "a7", accountName: "Pied Piper", ownerId: "u3", ownerName: "Priya Nair", closeDate: "2026-05-01", createdAt: "2026-03-25", updatedAt: "2026-05-01" },
  { id: "d8", name: "Nordström — Grid Analytics", stage: "proposal", type: "upsell", amount: 410000, probability: 55, source: "referral", accountId: "a9", accountName: "Nordström Energy", ownerId: "u1", ownerName: "Ava Reyes", closeDate: "2026-07-22", createdAt: "2026-04-08", updatedAt: "2026-05-23" },
  { id: "d9", name: "Maple Media — Content Hub", stage: "qualification", type: "new_business", amount: 38000, probability: 35, source: "ad", accountId: "a10", accountName: "Maple Media", ownerId: "u3", ownerName: "Priya Nair", closeDate: "2026-06-28", createdAt: "2026-04-30", updatedAt: "2026-05-22" },
  { id: "d10", name: "Acme — Automation License", stage: "prospecting", type: "new_business", amount: 132000, probability: 15, source: "partner", accountId: "a11", accountName: "Acme Robotics", ownerId: "u2", ownerName: "Marcus Webb", closeDate: "2026-09-30", createdAt: "2026-05-04", updatedAt: "2026-05-19" },
  { id: "d11", name: "Cyberdyne — Security Add-on", stage: "negotiation", type: "upsell", amount: 215000, probability: 80, source: "referral", accountId: "a12", accountName: "Cyberdyne Labs", ownerId: "u1", ownerName: "Ava Reyes", closeDate: "2026-06-09", createdAt: "2026-03-30", updatedAt: "2026-05-28" },
  { id: "d12", name: "Globex — Support Upgrade", stage: "closed_won", type: "upsell", amount: 54000, probability: 100, source: "web", accountId: "a1", accountName: "Globex Corporation", ownerId: "u1", ownerName: "Ava Reyes", closeDate: "2026-04-18", createdAt: "2026-02-01", updatedAt: "2026-04-18" },
  { id: "d13", name: "Stark — R&D Add-on", stage: "proposal", type: "expansion", amount: 175000, probability: 50, source: "event", accountId: "a3", accountName: "Stark Industries", ownerId: "u1", ownerName: "Ava Reyes", closeDate: "2026-07-31", createdAt: "2026-04-25", updatedAt: "2026-05-21" },
  { id: "d14", name: "Initech — Seat Expansion", stage: "qualification", type: "expansion", amount: 42000, probability: 45, source: "web", accountId: "a2", accountName: "Initech Systems", ownerId: "u2", ownerName: "Marcus Webb", closeDate: "2026-08-12", createdAt: "2026-05-09", updatedAt: "2026-05-24" },
];

export const dealById = (id: string): Deal | undefined =>
  deals.find((d) => d.id === id);
