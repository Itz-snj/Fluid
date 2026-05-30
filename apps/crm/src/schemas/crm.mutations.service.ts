import type { MutationDef } from "@fluid/core";
import { activities } from "../data/activities";
import { cases } from "../data/cases";
import { campaigns } from "../data/campaigns";
import { userById } from "../data/users";

/**
 * Service-side write operations (Activities, Cases, Campaigns).
 * Same contract as the sales mutations: server-only, in-memory, never throws
 * for expected validation failures.
 */

const today = () => new Date().toISOString().slice(0, 10);

export const serviceMutations: Record<string, MutationDef> = {
  completeActivity: {
    entity: "Activity",
    args: { id: { type: "string", required: true } },
    label: "Mark an activity as completed",
    handler: async (args: Record<string, unknown>) => {
      const act = activities.find((a) => a.id === args.id);
      if (!act) return { ok: false, error: `Activity "${String(args.id)}" not found` };
      if (act.status === "cancelled") {
        return { ok: false, error: `Activity "${act.subject}" was cancelled` };
      }
      act.status = "completed";
      act.completedAt = today();
      return { ok: true };
    },
  },

  cancelActivity: {
    entity: "Activity",
    args: { id: { type: "string", required: true } },
    label: "Cancel an open activity",
    handler: async (args: Record<string, unknown>) => {
      const act = activities.find((a) => a.id === args.id);
      if (!act) return { ok: false, error: `Activity "${String(args.id)}" not found` };
      if (act.status === "completed") {
        return { ok: false, error: `Activity "${act.subject}" is already completed` };
      }
      act.status = "cancelled";
      return { ok: true };
    },
  },

  reassignActivity: {
    entity: "Activity",
    args: { id: { type: "string", required: true }, ownerId: { type: "string", required: true } },
    label: "Reassign an activity to another user",
    handler: async (args: Record<string, unknown>) => {
      const act = activities.find((a) => a.id === args.id);
      if (!act) return { ok: false, error: `Activity "${String(args.id)}" not found` };
      const owner = userById(String(args.ownerId));
      if (!owner) return { ok: false, error: `User "${String(args.ownerId)}" not found` };
      act.ownerId = owner.id;
      act.ownerName = owner.name;
      return { ok: true };
    },
  },

  updateCaseStatus: {
    entity: "Case",
    args: { id: { type: "string", required: true }, status: { type: "enum", required: true } },
    label: "Change a case's status",
    handler: async (args: Record<string, unknown>) => {
      const kase = cases.find((k) => k.id === args.id);
      if (!kase) return { ok: false, error: `Case "${String(args.id)}" not found` };
      const allowed = ["new", "in_progress", "waiting", "escalated", "closed"];
      if (!allowed.includes(String(args.status))) {
        return { ok: false, error: `Invalid status "${String(args.status)}"` };
      }
      kase.status = args.status as typeof kase.status;
      kase.closedAt = kase.status === "closed" ? today() : "";
      return { ok: true };
    },
  },

  escalateCase: {
    entity: "Case",
    args: { id: { type: "string", required: true } },
    label: "Escalate a case to urgent priority",
    handler: async (args: Record<string, unknown>) => {
      const kase = cases.find((k) => k.id === args.id);
      if (!kase) return { ok: false, error: `Case "${String(args.id)}" not found` };
      if (kase.status === "closed") {
        return { ok: false, error: `Case "${kase.subject}" is closed` };
      }
      kase.status = "escalated";
      kase.priority = "urgent";
      return { ok: true };
    },
  },

  closeCase: {
    entity: "Case",
    args: { id: { type: "string", required: true } },
    label: "Close a case",
    handler: async (args: Record<string, unknown>) => {
      const kase = cases.find((k) => k.id === args.id);
      if (!kase) return { ok: false, error: `Case "${String(args.id)}" not found` };
      kase.status = "closed";
      kase.closedAt = today();
      return { ok: true };
    },
  },

  reassignCase: {
    entity: "Case",
    args: { id: { type: "string", required: true }, ownerId: { type: "string", required: true } },
    label: "Reassign a case to another agent",
    handler: async (args: Record<string, unknown>) => {
      const kase = cases.find((k) => k.id === args.id);
      if (!kase) return { ok: false, error: `Case "${String(args.id)}" not found` };
      const owner = userById(String(args.ownerId));
      if (!owner) return { ok: false, error: `User "${String(args.ownerId)}" not found` };
      kase.ownerId = owner.id;
      kase.ownerName = owner.name;
      return { ok: true };
    },
  },

  activateCampaign: {
    entity: "Campaign",
    args: { id: { type: "string", required: true } },
    label: "Activate a planned or paused campaign",
    handler: async (args: Record<string, unknown>) => {
      const cm = campaigns.find((c) => c.id === args.id);
      if (!cm) return { ok: false, error: `Campaign "${String(args.id)}" not found` };
      if (cm.status === "completed") {
        return { ok: false, error: `Campaign "${cm.name}" is already completed` };
      }
      cm.status = "active";
      return { ok: true };
    },
  },

  pauseCampaign: {
    entity: "Campaign",
    args: { id: { type: "string", required: true } },
    label: "Pause an active campaign",
    handler: async (args: Record<string, unknown>) => {
      const cm = campaigns.find((c) => c.id === args.id);
      if (!cm) return { ok: false, error: `Campaign "${String(args.id)}" not found` };
      if (cm.status !== "active") {
        return { ok: false, error: `Campaign "${cm.name}" is not active` };
      }
      cm.status = "paused";
      return { ok: true };
    },
  },
};
