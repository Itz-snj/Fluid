import type { Lead } from "../schemas/crm.types";

/** Top-of-funnel leads, not yet converted to accounts/contacts/deals. */
export const leads: Lead[] = [
  { id: "l1", name: "Jordan Pierce", company: "Quantum Dynamics", email: "jordan@quantumdyn.com", phone: "+1-206-555-0301", title: "VP Sales", status: "new", source: "web", rating: "warm", estimatedValue: 45000, ownerId: "u1", ownerName: "Ava Reyes", createdAt: "2026-05-18", updatedAt: "2026-05-18" },
  { id: "l2", name: "Mei Lin", company: "Skyline Logistics", email: "mei@skylinelog.com", phone: "+1-312-555-0302", title: "COO", status: "contacted", source: "event", rating: "hot", estimatedValue: 120000, ownerId: "u2", ownerName: "Marcus Webb", createdAt: "2026-05-10", updatedAt: "2026-05-22" },
  { id: "l3", name: "Omar Haddad", company: "Brightpath EdTech", email: "omar@brightpath.io", phone: "+1-617-555-0303", title: "Founder", status: "qualified", source: "referral", rating: "hot", estimatedValue: 78000, ownerId: "u3", ownerName: "Priya Nair", createdAt: "2026-04-28", updatedAt: "2026-05-20" },
  { id: "l4", name: "Greta Olsson", company: "Fjord Analytics", email: "greta@fjord.no", phone: "+47-22-555-0304", title: "Data Lead", status: "new", source: "ad", rating: "cold", estimatedValue: 22000, ownerId: "u1", ownerName: "Ava Reyes", createdAt: "2026-05-25", updatedAt: "2026-05-25" },
  { id: "l5", name: "Raj Malhotra", company: "Vertex Pharma", email: "raj@vertexpharma.com", phone: "+1-732-555-0305", title: "Director IT", status: "contacted", source: "cold_call", rating: "warm", estimatedValue: 210000, ownerId: "u2", ownerName: "Marcus Webb", createdAt: "2026-05-12", updatedAt: "2026-05-19" },
  { id: "l6", name: "Chloe Martin", company: "Lumen Studios", email: "chloe@lumenstudios.fr", phone: "+33-1-555-0306", title: "Producer", status: "qualified", source: "partner", rating: "warm", estimatedValue: 36000, ownerId: "u3", ownerName: "Priya Nair", createdAt: "2026-05-02", updatedAt: "2026-05-21" },
  { id: "l7", name: "Daniel Cho", company: "Apex Robotics", email: "daniel@apexrobotics.kr", phone: "+82-2-555-0307", title: "CTO", status: "unqualified", source: "web", rating: "cold", estimatedValue: 15000, ownerId: "u1", ownerName: "Ava Reyes", createdAt: "2026-04-15", updatedAt: "2026-05-05" },
  { id: "l8", name: "Fatima Noor", company: "Crescent Bank", email: "fatima@crescentbank.ae", phone: "+971-4-555-0308", title: "Head of Digital", status: "new", source: "event", rating: "hot", estimatedValue: 340000, ownerId: "u2", ownerName: "Marcus Webb", createdAt: "2026-05-24", updatedAt: "2026-05-24" },
  { id: "l9", name: "Lucas Real", company: "Verde Agritech", email: "lucas@verde.br", phone: "+55-11-555-0309", title: "Ops Manager", status: "contacted", source: "referral", rating: "warm", estimatedValue: 54000, ownerId: "u3", ownerName: "Priya Nair", createdAt: "2026-05-08", updatedAt: "2026-05-23" },
  { id: "l10", name: "Hannah Berg", company: "Polar Cloud", email: "hannah@polarcloud.is", phone: "+354-555-0310", title: "VP Eng", status: "qualified", source: "web", rating: "hot", estimatedValue: 96000, ownerId: "u1", ownerName: "Ava Reyes", createdAt: "2026-04-30", updatedAt: "2026-05-22" },
  { id: "l11", name: "Victor Nguyen", company: "Helix Bio", email: "victor@helixbio.com", phone: "+1-858-555-0311", title: "Procurement", status: "contacted", source: "ad", rating: "cold", estimatedValue: 28000, ownerId: "u2", ownerName: "Marcus Webb", createdAt: "2026-05-14", updatedAt: "2026-05-17" },
  { id: "l12", name: "Sofia Rossi", company: "Aurora Travel", email: "sofia@auroratravel.it", phone: "+39-06-555-0312", title: "CEO", status: "new", source: "partner", rating: "warm", estimatedValue: 67000, ownerId: "u3", ownerName: "Priya Nair", createdAt: "2026-05-26", updatedAt: "2026-05-26" },
];

export const leadById = (id: string): Lead | undefined =>
  leads.find((l) => l.id === id);
