import type { MutationDef } from "@fluid/core";
import { leads } from "../data/leads";
import { deals } from "../data/deals";
import { accounts } from "../data/accounts";
import { contacts } from "../data/contacts";
import { userById } from "../data/users";
import type { DealStage } from "./crm.types";

/**
 * Sales-side write operations (Leads + Deals).
 *
 * Handlers run server-side only, inside /api/mutate. They mutate the in-memory
 * seed arrays and keep denormalized `*Name` fields in sync with their `*Id`.
 * Each returns { ok, error? }; never throws for expected validation failures.
 */

const DEAL_STAGES: DealStage[] = [
  "prospecting", "qualification", "proposal", "negotiation", "closed_won", "closed_lost",
];
const today = () => new Date().toISOString().slice(0, 10);

export const salesMutations: Record<string, MutationDef> = {
  updateLeadStatus: {
    entity: "Lead",
    args: { id: { type: "string", required: true }, status: { type: "enum", required: true } },
    label: "Change a lead's status",
    handler: async (args: Record<string, unknown>) => {
      const lead = leads.find((l) => l.id === args.id);
      if (!lead) return { ok: false, error: `Lead "${String(args.id)}" not found` };
      const allowed = ["new", "contacted", "qualified", "unqualified", "converted"];
      if (!allowed.includes(String(args.status))) {
        return { ok: false, error: `Invalid status "${String(args.status)}"` };
      }
      lead.status = args.status as typeof lead.status;
      lead.updatedAt = today();
      return { ok: true };
    },
  },

  convertLead: {
    entity: "Lead",
    args: { id: { type: "string", required: true } },
    label: "Convert a qualified lead into an account, contact, and deal",
    handler: async (args: Record<string, unknown>) => {
      const lead = leads.find((l) => l.id === args.id);
      if (!lead) return { ok: false, error: `Lead "${String(args.id)}" not found` };
      if (lead.status === "converted") {
        return { ok: false, error: `Lead "${lead.name}" is already converted` };
      }
      const n = accounts.length + 1;
      const accountId = `a${n}`;
      accounts.push({
        id: accountId, name: lead.company, industry: "technology", type: "prospect",
        tier: "mid_market", annualRevenue: 0, employees: 0, website: "", country: "",
        ownerId: lead.ownerId, ownerName: lead.ownerName, createdAt: today(),
      });
      const contactId = `c${contacts.length + 1}`;
      contacts.push({
        id: contactId, name: lead.name, title: lead.title, email: lead.email,
        phone: lead.phone, department: "", isPrimary: true, accountId,
        accountName: lead.company, ownerId: lead.ownerId, ownerName: lead.ownerName,
        createdAt: today(),
      });
      deals.push({
        id: `d${deals.length + 1}`, name: `${lead.company} — New Deal`, stage: "qualification",
        type: "new_business", amount: lead.estimatedValue, probability: 30, source: lead.source,
        accountId, accountName: lead.company, ownerId: lead.ownerId, ownerName: lead.ownerName,
        closeDate: "", createdAt: today(), updatedAt: today(),
      });
      lead.status = "converted";
      lead.updatedAt = today();
      return { ok: true };
    },
  },

  advanceDealStage: {
    entity: "Deal",
    args: { id: { type: "string", required: true } },
    label: "Move a deal forward one pipeline stage",
    handler: async (args: Record<string, unknown>) => {
      const deal = deals.find((d) => d.id === args.id);
      if (!deal) return { ok: false, error: `Deal "${String(args.id)}" not found` };
      const i = DEAL_STAGES.indexOf(deal.stage);
      if (i >= DEAL_STAGES.indexOf("negotiation")) {
        return { ok: false, error: `Deal "${deal.name}" cannot be advanced from "${deal.stage}"` };
      }
      deal.stage = DEAL_STAGES[i + 1];
      deal.updatedAt = today();
      return { ok: true };
    },
  },

  setDealStage: {
    entity: "Deal",
    args: { id: { type: "string", required: true }, stage: { type: "enum", required: true } },
    label: "Set a deal to a specific stage",
    handler: async (args: Record<string, unknown>) => {
      const deal = deals.find((d) => d.id === args.id);
      if (!deal) return { ok: false, error: `Deal "${String(args.id)}" not found` };
      if (!DEAL_STAGES.includes(args.stage as DealStage)) {
        return { ok: false, error: `Invalid stage "${String(args.stage)}"` };
      }
      deal.stage = args.stage as DealStage;
      if (deal.stage === "closed_won") deal.probability = 100;
      if (deal.stage === "closed_lost") deal.probability = 0;
      deal.updatedAt = today();
      return { ok: true };
    },
  },

  closeDealWon: {
    entity: "Deal",
    args: { id: { type: "string", required: true } },
    label: "Mark a deal as closed-won",
    handler: async (args: Record<string, unknown>) => {
      const deal = deals.find((d) => d.id === args.id);
      if (!deal) return { ok: false, error: `Deal "${String(args.id)}" not found` };
      deal.stage = "closed_won";
      deal.probability = 100;
      deal.updatedAt = today();
      return { ok: true };
    },
  },

  closeDealLost: {
    entity: "Deal",
    args: { id: { type: "string", required: true } },
    label: "Mark a deal as closed-lost",
    handler: async (args: Record<string, unknown>) => {
      const deal = deals.find((d) => d.id === args.id);
      if (!deal) return { ok: false, error: `Deal "${String(args.id)}" not found` };
      deal.stage = "closed_lost";
      deal.probability = 0;
      deal.updatedAt = today();
      return { ok: true };
    },
  },

  reassignDeal: {
    entity: "Deal",
    args: { id: { type: "string", required: true }, ownerId: { type: "string", required: true } },
    label: "Reassign a deal to another user",
    handler: async (args: Record<string, unknown>) => {
      const deal = deals.find((d) => d.id === args.id);
      if (!deal) return { ok: false, error: `Deal "${String(args.id)}" not found` };
      const owner = userById(String(args.ownerId));
      if (!owner) return { ok: false, error: `User "${String(args.ownerId)}" not found` };
      deal.ownerId = owner.id;
      deal.ownerName = owner.name;
      deal.updatedAt = today();
      return { ok: true };
    },
  },
};
