import { defineSchema } from "@fluid/core";
import { crmEntities } from "./crm.entities";
import { salesMutations } from "./crm.mutations.sales";
import { serviceMutations } from "./crm.mutations.service";

import { users } from "../data/users";
import { leads } from "../data/leads";
import { accounts } from "../data/accounts";
import { contacts } from "../data/contacts";
import { deals } from "../data/deals";
import { activities } from "../data/activities";
import { products } from "../data/products";
import { quotes } from "../data/quotes";
import { cases } from "../data/cases";
import { campaigns } from "../data/campaigns";

/**
 * The CRM schema — the single capability declaration handed to the engine.
 *
 * - `entities` is the sandbox: the LLM may reference only these entities/fields.
 * - `endpoints` map an entity name to a `fetch()` returning its rows. In this
 *   demo they return in-memory arrays; a real consumer would query their DB.
 *   The endpoint KEY is what `page.tsx` iterates; `entity` is the DataContext key.
 * - `mutations` are server-only write ops the LLM may reference in action nodes.
 *
 * Endpoints return the live array reference, so mutations performed via
 * /api/mutate are reflected on the next fetch within the same process.
 */
export const crmSchema = defineSchema({
  name: "crm",
  entities: crmEntities,
  endpoints: {
    users: { entity: "User", fetch: () => users },
    leads: { entity: "Lead", fetch: () => leads },
    accounts: { entity: "Account", fetch: () => accounts },
    contacts: { entity: "Contact", fetch: () => contacts },
    deals: { entity: "Deal", fetch: () => deals },
    activities: { entity: "Activity", fetch: () => activities },
    products: { entity: "Product", fetch: () => products },
    quotes: { entity: "Quote", fetch: () => quotes },
    cases: { entity: "Case", fetch: () => cases },
    campaigns: { entity: "Campaign", fetch: () => campaigns },
  },
  mutations: {
    ...salesMutations,
    ...serviceMutations,
  },
});

export type CrmSchema = typeof crmSchema;
