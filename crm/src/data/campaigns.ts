import type { Campaign } from "../schemas/crm.types";

/** Marketing campaigns. budget/actualCost/expectedRevenue numeric for ROI stats. */
export const campaigns: Campaign[] = [
  { id: "cm1", name: "Q2 Enterprise Webinar Series", type: "webinar", status: "active", budget: 40000, actualCost: 22000, expectedRevenue: 600000, numLeads: 180, startDate: "2026-04-01", endDate: "2026-06-30", ownerId: "u4", ownerName: "Diego Santos" },
  { id: "cm2", name: "Spring Email Nurture", type: "email", status: "active", budget: 12000, actualCost: 7500, expectedRevenue: 220000, numLeads: 320, startDate: "2026-03-15", endDate: "2026-06-15", ownerId: "u5", ownerName: "Lena Fischer" },
  { id: "cm3", name: "SaaStr Annual Booth", type: "event", status: "completed", budget: 85000, actualCost: 91000, expectedRevenue: 1200000, numLeads: 240, startDate: "2026-02-01", endDate: "2026-03-01", ownerId: "u4", ownerName: "Diego Santos" },
  { id: "cm4", name: "LinkedIn Paid Q2", type: "paid_ads", status: "active", budget: 30000, actualCost: 18400, expectedRevenue: 350000, numLeads: 410, startDate: "2026-04-10", endDate: "2026-06-30", ownerId: "u5", ownerName: "Lena Fischer" },
  { id: "cm5", name: "Security Whitepaper Push", type: "content", status: "paused", budget: 8000, actualCost: 3200, expectedRevenue: 90000, numLeads: 65, startDate: "2026-05-01", endDate: "2026-07-01", ownerId: "u4", ownerName: "Diego Santos" },
  { id: "cm6", name: "Summer Product Launch", type: "event", status: "planned", budget: 120000, actualCost: 0, expectedRevenue: 1800000, numLeads: 0, startDate: "2026-07-15", endDate: "2026-08-15", ownerId: "u5", ownerName: "Lena Fischer" },
  { id: "cm7", name: "Healthcare Vertical Webinar", type: "webinar", status: "completed", budget: 15000, actualCost: 14200, expectedRevenue: 280000, numLeads: 95, startDate: "2026-03-20", endDate: "2026-04-20", ownerId: "u4", ownerName: "Diego Santos" },
  { id: "cm8", name: "Retargeting — Cold Leads", type: "paid_ads", status: "paused", budget: 20000, actualCost: 11000, expectedRevenue: 140000, numLeads: 210, startDate: "2026-04-25", endDate: "2026-06-25", ownerId: "u5", ownerName: "Lena Fischer" },
];

export const campaignById = (id: string): Campaign | undefined =>
  campaigns.find((c) => c.id === id);
