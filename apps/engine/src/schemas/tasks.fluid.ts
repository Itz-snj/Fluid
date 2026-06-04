import { defineSchema } from "@fluid-genui/core";

export type Task = {
  id: string;
  title: string;
  status: "backlog" | "in_progress" | "review" | "done";
  priority: "p0" | "p1" | "p2" | "p3";
  matter: string;
  assignee: string;
  dueAt: string;
  updatedAt: string;
};

export type Snippet = {
  id: string;
  title: string;
  body: string;
  matter: string;
  tags: string[];
};

export const tasks: Task[] = [
  { id: "t1", title: "Draft motion to dismiss", status: "in_progress", priority: "p0", matter: "Acme v. Globex", assignee: "Priya", dueAt: "2026-06-02", updatedAt: "2026-05-28" },
  { id: "t2", title: "Review witness statements", status: "review", priority: "p1", matter: "Acme v. Globex", assignee: "Marcus", dueAt: "2026-06-04", updatedAt: "2026-05-27" },
  { id: "t3", title: "File response brief", status: "backlog", priority: "p0", matter: "Stark Estate", assignee: "Priya", dueAt: "2026-06-09", updatedAt: "2026-05-26" },
  { id: "t4", title: "Schedule deposition", status: "done", priority: "p2", matter: "Stark Estate", assignee: "Lin", dueAt: "2026-05-25", updatedAt: "2026-05-25" },
  { id: "t5", title: "Migrate auth service to JWT", status: "in_progress", priority: "p0", matter: "Platform Q2", assignee: "Devansh", dueAt: "2026-06-03", updatedAt: "2026-05-29" },
  { id: "t6", title: "Add SSO for enterprise plan", status: "backlog", priority: "p1", matter: "Platform Q2", assignee: "Devansh", dueAt: "2026-06-15", updatedAt: "2026-05-22" },
  { id: "t7", title: "Postmortem for May 18 outage", status: "review", priority: "p1", matter: "Reliability", assignee: "Aria", dueAt: "2026-06-01", updatedAt: "2026-05-28" },
  { id: "t8", title: "Quarterly OKR rollup", status: "in_progress", priority: "p1", matter: "Q2 Planning", assignee: "Sam", dueAt: "2026-06-05", updatedAt: "2026-05-29" },
  { id: "t9", title: "Customer interview synthesis", status: "review", priority: "p2", matter: "Discovery", assignee: "Sam", dueAt: "2026-06-06", updatedAt: "2026-05-26" },
  { id: "t10", title: "Pricing experiment writeup", status: "backlog", priority: "p2", matter: "Growth", assignee: "Sam", dueAt: "2026-06-12", updatedAt: "2026-05-24" },
];

export const snippets: Snippet[] = [
  { id: "s1", title: "FRCP 12(b)(6) standard", body: "Twombly/Iqbal — facial plausibility…", matter: "Acme v. Globex", tags: ["civpro", "motion"] },
  { id: "s2", title: "Witness prep checklist", body: "1. Review prior testimony…", matter: "Acme v. Globex", tags: ["depo"] },
  { id: "s3", title: "Probate timeline (CA)", body: "Letters testamentary issued…", matter: "Stark Estate", tags: ["probate"] },
  { id: "s4", title: "JWT rotation notes", body: "Rotate signing key every 90 days…", matter: "Platform Q2", tags: ["security", "auth"] },
  { id: "s5", title: "OKR template", body: "Objective: …\\nKey Results: …", matter: "Q2 Planning", tags: ["planning"] },
  { id: "s6", title: "Outage runbook", body: "Step 1: page on-call…", matter: "Reliability", tags: ["sre"] },
];

export const taskSchema = defineSchema({
  name: "tasks",
  entities: {
    Task: {
      label: "Task",
      fields: {
        id: { type: "string" },
        title: { type: "string", label: "Title" },
        status: { type: "enum", values: ["backlog", "in_progress", "review", "done"], label: "Status" },
        priority: { type: "enum", values: ["p0", "p1", "p2", "p3"], label: "Priority" },
        matter: { type: "string", label: "Matter" },
        assignee: { type: "string", label: "Assignee" },
        dueAt: { type: "date", label: "Due" },
        updatedAt: { type: "date", label: "Updated" },
      },
    },
    Snippet: {
      label: "Snippet",
      fields: {
        id: { type: "string" },
        title: { type: "string", label: "Title" },
        body: { type: "string", label: "Body" },
        matter: { type: "string", label: "Matter" },
        tags: { type: "string", label: "Tags" },
      },
    },
  },
  endpoints: {
    listTasks: { entity: "Task", fetch: () => tasks },
    listSnippets: { entity: "Snippet", fetch: () => snippets },
  },
  mutations: {
    completeTask: {
      entity: "Task",
      args: { id: { type: "string", required: true } },
      handler: async (args: Record<string, unknown>) => {
        const task = tasks.find((t) => t.id === args.id);
        if (!task) return { ok: false, error: `Task "${String(args.id)}" not found` };
        task.status = "done";
        return { ok: true };
      },
      label: "Mark a task as done",
    },
    updateTaskStatus: {
      entity: "Task",
      args: {
        id: { type: "string", required: true },
        status: { type: "enum", required: true },
      },
      handler: async (args: Record<string, unknown>) => {
        const task = tasks.find((t) => t.id === args.id);
        if (!task) return { ok: false, error: `Task "${String(args.id)}" not found` };
        const allowed = ["backlog", "in_progress", "review", "done"];
        if (!allowed.includes(String(args.status))) {
          return { ok: false, error: `Invalid status "${String(args.status)}"` };
        }
        task.status = args.status as Task["status"];
        return { ok: true };
      },
      label: "Change the status of a task",
    },
  },
});

