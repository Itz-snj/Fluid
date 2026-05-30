import { defineSchema } from "@fluid/core";

/**
 * Demo Schema - Task Management System
 *
 * Demonstrates all Fluid features:
 * - Multiple entities (Task, Project, Team)
 * - Rich field types (enum, date, number, string)
 * - Multiple endpoints
 * - Interactive mutations
 */

// ============================================================================
// MOCK DATA (Replace with real database queries in production)
// ============================================================================

export type Task = {
  id: string;
  title: string;
  description: string;
  status: "backlog" | "todo" | "in_progress" | "review" | "done";
  priority: "critical" | "high" | "medium" | "low";
  projectId: string;
  assigneeId: string;
  dueDate: string;
  createdAt: string;
  updatedAt: string;
  tags: string[];
};

export type Project = {
  id: string;
  name: string;
  description: string;
  status: "planning" | "active" | "on_hold" | "completed";
  ownerId: string;
  budget: number;
  startDate: string;
  endDate: string;
  teamId: string;
};

export type Team = {
  id: string;
  name: string;
  department: string;
  memberCount: number;
  leadId: string;
};

export type User = {
  id: string;
  name: string;
  email: string;
  role: "engineer" | "designer" | "pm" | "manager";
  teamId: string;
  avatar: string;
};

// Mock data
export const mockUsers: User[] = [
  { id: "u1", name: "Alice Chen", email: "alice@example.com", role: "engineer", teamId: "t1", avatar: "👩‍💻" },
  { id: "u2", name: "Bob Smith", email: "bob@example.com", role: "designer", teamId: "t1", avatar: "👨‍🎨" },
  { id: "u3", name: "Carol Davis", email: "carol@example.com", role: "pm", teamId: "t2", avatar: "👩‍💼" },
  { id: "u4", name: "David Lee", email: "david@example.com", role: "engineer", teamId: "t2", avatar: "👨‍💻" },
  { id: "u5", name: "Emma Wilson", email: "emma@example.com", role: "manager", teamId: "t1", avatar: "👩‍💼" },
];

export const mockTeams: Team[] = [
  { id: "t1", name: "Platform Team", department: "Engineering", memberCount: 8, leadId: "u5" },
  { id: "t2", name: "Product Team", department: "Product", memberCount: 6, leadId: "u3" },
  { id: "t3", name: "Design Team", department: "Design", memberCount: 4, leadId: "u2" },
];

export const mockProjects: Project[] = [
  {
    id: "p1",
    name: "Authentication Overhaul",
    description: "Migrate to OAuth 2.0 with SSO support",
    status: "active",
    ownerId: "u1",
    budget: 150000,
    startDate: "2026-05-01",
    endDate: "2026-07-31",
    teamId: "t1",
  },
  {
    id: "p2",
    name: "Mobile App Launch",
    description: "iOS and Android native apps",
    status: "planning",
    ownerId: "u3",
    budget: 300000,
    startDate: "2026-06-15",
    endDate: "2026-12-31",
    teamId: "t2",
  },
  {
    id: "p3",
    name: "Design System v2",
    description: "Rebuild component library with accessibility focus",
    status: "active",
    ownerId: "u2",
    budget: 80000,
    startDate: "2026-04-01",
    endDate: "2026-08-31",
    teamId: "t3",
  },
  {
    id: "p4",
    name: "Analytics Dashboard",
    description: "Real-time metrics and reporting",
    status: "on_hold",
    ownerId: "u4",
    budget: 120000,
    startDate: "2026-03-01",
    endDate: "2026-06-30",
    teamId: "t1",
  },
];

export const mockTasks: Task[] = [
  {
    id: "t1",
    title: "Implement OAuth 2.0 flow",
    description: "Add authorization code flow with PKCE",
    status: "in_progress",
    priority: "critical",
    projectId: "p1",
    assigneeId: "u1",
    dueDate: "2026-06-05",
    createdAt: "2026-05-20",
    updatedAt: "2026-05-30",
    tags: ["backend", "security"],
  },
  {
    id: "t2",
    title: "Design SSO login screen",
    description: "Mockups for enterprise SSO flow",
    status: "review",
    priority: "high",
    projectId: "p1",
    assigneeId: "u2",
    dueDate: "2026-06-03",
    createdAt: "2026-05-22",
    updatedAt: "2026-05-29",
    tags: ["design", "ui"],
  },
  {
    id: "t3",
    title: "Write OAuth integration tests",
    description: "E2E tests for all OAuth flows",
    status: "todo",
    priority: "high",
    projectId: "p1",
    assigneeId: "u1",
    dueDate: "2026-06-10",
    createdAt: "2026-05-25",
    updatedAt: "2026-05-25",
    tags: ["testing", "backend"],
  },
  {
    id: "t4",
    title: "Research React Native vs Flutter",
    description: "Technical evaluation for mobile framework",
    status: "done",
    priority: "high",
    projectId: "p2",
    assigneeId: "u4",
    dueDate: "2026-05-28",
    createdAt: "2026-05-15",
    updatedAt: "2026-05-27",
    tags: ["research", "mobile"],
  },
  {
    id: "t5",
    title: "Mobile app wireframes",
    description: "Low-fidelity wireframes for core flows",
    status: "in_progress",
    priority: "medium",
    projectId: "p2",
    assigneeId: "u2",
    dueDate: "2026-06-08",
    createdAt: "2026-05-28",
    updatedAt: "2026-05-30",
    tags: ["design", "mobile"],
  },
  {
    id: "t6",
    title: "Audit current component library",
    description: "Document accessibility issues",
    status: "done",
    priority: "medium",
    projectId: "p3",
    assigneeId: "u2",
    dueDate: "2026-05-20",
    createdAt: "2026-04-10",
    updatedAt: "2026-05-19",
    tags: ["design", "a11y"],
  },
  {
    id: "t7",
    title: "Build accessible Button component",
    description: "WCAG 2.1 AA compliant button with keyboard nav",
    status: "in_progress",
    priority: "high",
    projectId: "p3",
    assigneeId: "u1",
    dueDate: "2026-06-01",
    createdAt: "2026-05-21",
    updatedAt: "2026-05-30",
    tags: ["frontend", "a11y"],
  },
  {
    id: "t8",
    title: "Setup analytics data pipeline",
    description: "Configure event streaming to data warehouse",
    status: "backlog",
    priority: "low",
    projectId: "p4",
    assigneeId: "u4",
    dueDate: "2026-06-20",
    createdAt: "2026-05-10",
    updatedAt: "2026-05-10",
    tags: ["backend", "data"],
  },
  {
    id: "t9",
    title: "Design dashboard layout",
    description: "Information architecture for metrics dashboard",
    status: "backlog",
    priority: "medium",
    projectId: "p4",
    assigneeId: "u2",
    dueDate: "2026-06-15",
    createdAt: "2026-05-12",
    updatedAt: "2026-05-12",
    tags: ["design", "dashboard"],
  },
  {
    id: "t10",
    title: "Document OAuth migration guide",
    description: "Write docs for existing users migrating to new auth",
    status: "todo",
    priority: "medium",
    projectId: "p1",
    assigneeId: "u3",
    dueDate: "2026-06-12",
    createdAt: "2026-05-26",
    updatedAt: "2026-05-26",
    tags: ["docs", "migration"],
  },
];

// ============================================================================
// SCHEMA DEFINITION
// ============================================================================

export const demoSchema = defineSchema({
  name: "demo",
  entities: {
    Task: {
      label: "Task",
      fields: {
        id: { type: "string", label: "ID" },
        title: { type: "string", label: "Title" },
        description: { type: "string", label: "Description" },
        status: {
          type: "enum",
          values: ["backlog", "todo", "in_progress", "review", "done"],
          label: "Status",
        },
        priority: {
          type: "enum",
          values: ["critical", "high", "medium", "low"],
          label: "Priority",
        },
        projectId: { type: "string", label: "Project ID" },
        assigneeId: { type: "string", label: "Assignee ID" },
        dueDate: { type: "date", label: "Due Date" },
        createdAt: { type: "date", label: "Created" },
        updatedAt: { type: "date", label: "Updated" },
        tags: { type: "string", label: "Tags" },
      },
    },
    Project: {
      label: "Project",
      fields: {
        id: { type: "string", label: "ID" },
        name: { type: "string", label: "Name" },
        description: { type: "string", label: "Description" },
        status: {
          type: "enum",
          values: ["planning", "active", "on_hold", "completed"],
          label: "Status",
        },
        ownerId: { type: "string", label: "Owner ID" },
        budget: { type: "number", label: "Budget" },
        startDate: { type: "date", label: "Start Date" },
        endDate: { type: "date", label: "End Date" },
        teamId: { type: "string", label: "Team ID" },
      },
    },
    Team: {
      label: "Team",
      fields: {
        id: { type: "string", label: "ID" },
        name: { type: "string", label: "Name" },
        department: { type: "string", label: "Department" },
        memberCount: { type: "number", label: "Members" },
        leadId: { type: "string", label: "Lead ID" },
      },
    },
    User: {
      label: "User",
      fields: {
        id: { type: "string", label: "ID" },
        name: { type: "string", label: "Name" },
        email: { type: "string", label: "Email" },
        role: {
          type: "enum",
          values: ["engineer", "designer", "pm", "manager"],
          label: "Role",
        },
        teamId: { type: "string", label: "Team ID" },
        avatar: { type: "string", label: "Avatar" },
      },
    },
  },
  endpoints: {
    tasks: {
      entity: "Task",
      fetch: async () => mockTasks,
    },
    projects: {
      entity: "Project",
      fetch: async () => mockProjects,
    },
    teams: {
      entity: "Team",
      fetch: async () => mockTeams,
    },
    users: {
      entity: "User",
      fetch: async () => mockUsers,
    },
  },
  mutations: {
    updateTaskStatus: {
      entity: "Task",
      label: "Update task status",
      args: {
        id: { type: "string", required: true },
        status: { type: "enum", required: true },
      },
      handler: async (args: Record<string, unknown>) => {
        const task = mockTasks.find((t) => t.id === args.id);
        if (!task) {
          return { ok: false, error: `Task ${String(args.id)} not found` };
        }
        const validStatuses = ["backlog", "todo", "in_progress", "review", "done"];
        if (!validStatuses.includes(String(args.status))) {
          return { ok: false, error: `Invalid status: ${String(args.status)}` };
        }
        task.status = args.status as Task["status"];
        task.updatedAt = new Date().toISOString();
        return { ok: true, message: `Task ${task.title} updated to ${args.status}` };
      },
    },
    completeTask: {
      entity: "Task",
      label: "Mark task as done",
      args: {
        id: { type: "string", required: true },
      },
      handler: async (args: Record<string, unknown>) => {
        const task = mockTasks.find((t) => t.id === args.id);
        if (!task) {
          return { ok: false, error: `Task ${String(args.id)} not found` };
        }
        task.status = "done";
        task.updatedAt = new Date().toISOString();
        return { ok: true, message: `Task "${task.title}" marked as done` };
      },
    },
    updateProjectStatus: {
      entity: "Project",
      label: "Update project status",
      args: {
        id: { type: "string", required: true },
        status: { type: "enum", required: true },
      },
      handler: async (args: Record<string, unknown>) => {
        const project = mockProjects.find((p) => p.id === args.id);
        if (!project) {
          return { ok: false, error: `Project ${String(args.id)} not found` };
        }
        const validStatuses = ["planning", "active", "on_hold", "completed"];
        if (!validStatuses.includes(String(args.status))) {
          return { ok: false, error: `Invalid status: ${String(args.status)}` };
        }
        project.status = args.status as Project["status"];
        return { ok: true, message: `Project ${project.name} updated to ${args.status}` };
      },
    },
  },
});
