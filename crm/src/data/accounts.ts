import type { Account } from "../schemas/crm.types";

/** Customer / prospect organizations. `ownerName` mirrors `ownerId`. */
export const accounts: Account[] = [
  { id: "a1", name: "Globex Corporation", industry: "technology", type: "customer", tier: "enterprise", annualRevenue: 480000000, employees: 5200, website: "globex.com", country: "USA", ownerId: "u1", ownerName: "Ava Reyes", createdAt: "2024-03-12" },
  { id: "a2", name: "Initech Systems", industry: "technology", type: "customer", tier: "mid_market", annualRevenue: 62000000, employees: 410, website: "initech.com", country: "USA", ownerId: "u2", ownerName: "Marcus Webb", createdAt: "2024-06-01" },
  { id: "a3", name: "Stark Industries", industry: "manufacturing", type: "customer", tier: "enterprise", annualRevenue: 1200000000, employees: 14000, website: "stark.com", country: "USA", ownerId: "u1", ownerName: "Ava Reyes", createdAt: "2023-11-20" },
  { id: "a4", name: "Wayne Health", industry: "healthcare", type: "prospect", tier: "enterprise", annualRevenue: 890000000, employees: 9100, website: "waynehealth.org", country: "USA", ownerId: "u2", ownerName: "Marcus Webb", createdAt: "2025-01-15" },
  { id: "a5", name: "Umbrella Retail", industry: "retail", type: "customer", tier: "mid_market", annualRevenue: 145000000, employees: 1200, website: "umbrella-retail.com", country: "UK", ownerId: "u3", ownerName: "Priya Nair", createdAt: "2024-09-08" },
  { id: "a6", name: "Hooli Finance", industry: "finance", type: "prospect", tier: "enterprise", annualRevenue: 2100000000, employees: 8800, website: "hooli.com", country: "USA", ownerId: "u1", ownerName: "Ava Reyes", createdAt: "2025-02-28" },
  { id: "a7", name: "Pied Piper", industry: "technology", type: "prospect", tier: "smb", annualRevenue: 8000000, employees: 45, website: "piedpiper.com", country: "USA", ownerId: "u3", ownerName: "Priya Nair", createdAt: "2025-03-19" },
  { id: "a8", name: "Soylent Foods", industry: "manufacturing", type: "churned", tier: "mid_market", annualRevenue: 98000000, employees: 760, website: "soylent.com", country: "USA", ownerId: "u2", ownerName: "Marcus Webb", createdAt: "2023-07-30" },
  { id: "a9", name: "Nordström Energy", industry: "energy", type: "customer", tier: "enterprise", annualRevenue: 3400000000, employees: 21000, website: "nordstrom-energy.se", country: "Sweden", ownerId: "u1", ownerName: "Ava Reyes", createdAt: "2024-01-22" },
  { id: "a10", name: "Maple Media", industry: "media", type: "customer", tier: "smb", annualRevenue: 12000000, employees: 88, website: "maplemedia.ca", country: "Canada", ownerId: "u3", ownerName: "Priya Nair", createdAt: "2024-12-05" },
  { id: "a11", name: "Acme Robotics", industry: "manufacturing", type: "prospect", tier: "mid_market", annualRevenue: 54000000, employees: 320, website: "acme-robotics.com", country: "Germany", ownerId: "u2", ownerName: "Marcus Webb", createdAt: "2025-04-02" },
  { id: "a12", name: "Cyberdyne Labs", industry: "technology", type: "customer", tier: "enterprise", annualRevenue: 760000000, employees: 6400, website: "cyberdyne.ai", country: "USA", ownerId: "u1", ownerName: "Ava Reyes", createdAt: "2023-05-17" },
];

export const accountById = (id: string): Account | undefined =>
  accounts.find((a) => a.id === id);
