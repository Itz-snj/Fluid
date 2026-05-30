import type { User } from "../schemas/crm.types";

/**
 * Internal CRM users. Owners are referenced by id across every entity and
 * denormalized to `ownerName` on each row for the renderer.
 */
export const users: User[] = [
  { id: "u1", name: "Ava Reyes", email: "ava@northwind.io", role: "sales_rep", team: "Enterprise West", active: true },
  { id: "u2", name: "Marcus Webb", email: "marcus@northwind.io", role: "sales_rep", team: "Enterprise East", active: true },
  { id: "u3", name: "Priya Nair", email: "priya@northwind.io", role: "sales_rep", team: "Mid-Market", active: true },
  { id: "u4", name: "Diego Santos", email: "diego@northwind.io", role: "sales_manager", team: "Enterprise West", active: true },
  { id: "u5", name: "Lena Fischer", email: "lena@northwind.io", role: "sales_manager", team: "Mid-Market", active: true },
  { id: "u6", name: "Tom Becker", email: "tom@northwind.io", role: "support_agent", team: "Support Tier 2", active: true },
  { id: "u7", name: "Yuki Tanaka", email: "yuki@northwind.io", role: "support_agent", team: "Support Tier 1", active: true },
  { id: "u8", name: "Sara Okonkwo", email: "sara@northwind.io", role: "admin", team: "RevOps", active: true },
];

export const userById = (id: string): User | undefined =>
  users.find((u) => u.id === id);
