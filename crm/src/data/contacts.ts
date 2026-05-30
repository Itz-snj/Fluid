import type { Contact } from "../schemas/crm.types";

/** People at accounts. `accountName` / `ownerName` denormalized for rendering. */
export const contacts: Contact[] = [
  { id: "c1", name: "Hank Scorpio", title: "VP Engineering", email: "hank@globex.com", phone: "+1-415-555-0101", department: "Engineering", isPrimary: true, accountId: "a1", accountName: "Globex Corporation", ownerId: "u1", ownerName: "Ava Reyes", createdAt: "2024-03-14" },
  { id: "c2", name: "Carol Danvers", title: "CTO", email: "carol@globex.com", phone: "+1-415-555-0102", department: "Technology", isPrimary: false, accountId: "a1", accountName: "Globex Corporation", ownerId: "u1", ownerName: "Ava Reyes", createdAt: "2024-04-01" },
  { id: "c3", name: "Bill Lumbergh", title: "Director of IT", email: "bill@initech.com", phone: "+1-512-555-0110", department: "IT", isPrimary: true, accountId: "a2", accountName: "Initech Systems", ownerId: "u2", ownerName: "Marcus Webb", createdAt: "2024-06-03" },
  { id: "c4", name: "Pepper Potts", title: "COO", email: "pepper@stark.com", phone: "+1-212-555-0120", department: "Operations", isPrimary: true, accountId: "a3", accountName: "Stark Industries", ownerId: "u1", ownerName: "Ava Reyes", createdAt: "2023-11-22" },
  { id: "c5", name: "Bruce Banner", title: "Head of R&D", email: "bruce@stark.com", phone: "+1-212-555-0121", department: "R&D", isPrimary: false, accountId: "a3", accountName: "Stark Industries", ownerId: "u1", ownerName: "Ava Reyes", createdAt: "2024-02-10" },
  { id: "c6", name: "Lucius Fox", title: "CFO", email: "lucius@waynehealth.org", phone: "+1-312-555-0130", department: "Finance", isPrimary: true, accountId: "a4", accountName: "Wayne Health", ownerId: "u2", ownerName: "Marcus Webb", createdAt: "2025-01-18" },
  { id: "c7", name: "Alice Wong", title: "Procurement Lead", email: "alice@umbrella-retail.com", phone: "+44-20-555-0140", department: "Procurement", isPrimary: true, accountId: "a5", accountName: "Umbrella Retail", ownerId: "u3", ownerName: "Priya Nair", createdAt: "2024-09-10" },
  { id: "c8", name: "Gavin Belson", title: "CEO", email: "gavin@hooli.com", phone: "+1-650-555-0150", department: "Executive", isPrimary: true, accountId: "a6", accountName: "Hooli Finance", ownerId: "u1", ownerName: "Ava Reyes", createdAt: "2025-03-01" },
  { id: "c9", name: "Richard Hendricks", title: "Founder", email: "richard@piedpiper.com", phone: "+1-650-555-0160", department: "Executive", isPrimary: true, accountId: "a7", accountName: "Pied Piper", ownerId: "u3", ownerName: "Priya Nair", createdAt: "2025-03-21" },
  { id: "c10", name: "Erik Lund", title: "VP Operations", email: "erik@nordstrom-energy.se", phone: "+46-8-555-0170", department: "Operations", isPrimary: true, accountId: "a9", accountName: "Nordström Energy", ownerId: "u1", ownerName: "Ava Reyes", createdAt: "2024-01-25" },
  { id: "c11", name: "Nadia Khan", title: "Marketing Director", email: "nadia@maplemedia.ca", phone: "+1-416-555-0180", department: "Marketing", isPrimary: true, accountId: "a10", accountName: "Maple Media", ownerId: "u3", ownerName: "Priya Nair", createdAt: "2024-12-07" },
  { id: "c12", name: "Klaus Werner", title: "Head of Automation", email: "klaus@acme-robotics.com", phone: "+49-30-555-0190", department: "Engineering", isPrimary: true, accountId: "a11", accountName: "Acme Robotics", ownerId: "u2", ownerName: "Marcus Webb", createdAt: "2025-04-04" },
  { id: "c13", name: "Sarah Connor", title: "VP Security", email: "sarah@cyberdyne.ai", phone: "+1-408-555-0200", department: "Security", isPrimary: true, accountId: "a12", accountName: "Cyberdyne Labs", ownerId: "u1", ownerName: "Ava Reyes", createdAt: "2023-05-20" },
  { id: "c14", name: "Miles Dyson", title: "Principal Engineer", email: "miles@cyberdyne.ai", phone: "+1-408-555-0201", department: "Engineering", isPrimary: false, accountId: "a12", accountName: "Cyberdyne Labs", ownerId: "u1", ownerName: "Ava Reyes", createdAt: "2023-08-11" },
];

export const contactById = (id: string): Contact | undefined =>
  contacts.find((c) => c.id === id);
