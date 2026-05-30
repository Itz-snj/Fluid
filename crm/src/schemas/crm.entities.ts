import type { EntityDef } from "@fluid/core";

/**
 * Entity field declarations for the CRM schema — the sandbox boundary.
 *
 * The LLM may only reference entities/fields declared here. `ref` fields carry
 * a foreign-key id and document the true relational model; the matching
 * `*Name` string field is what the renderer actually binds to (no joins).
 *
 * Enum `values` are the exact set the IR may use (e.g. kanban columns), so they
 * must match the string-literal unions in crm.types.ts.
 */
export const crmEntities: Record<string, EntityDef> = {
  User: {
    label: "User",
    fields: {
      id: { type: "string" },
      name: { type: "string", label: "Name" },
      email: { type: "string", label: "Email" },
      role: { type: "enum", values: ["sales_rep", "sales_manager", "support_agent", "admin"], label: "Role" },
      team: { type: "string", label: "Team" },
      active: { type: "boolean", label: "Active" },
    },
  },

  Lead: {
    label: "Lead",
    fields: {
      id: { type: "string" },
      name: { type: "string", label: "Name" },
      company: { type: "string", label: "Company" },
      email: { type: "string", label: "Email" },
      phone: { type: "string", label: "Phone" },
      title: { type: "string", label: "Title" },
      status: { type: "enum", values: ["new", "contacted", "qualified", "unqualified", "converted"], label: "Status" },
      source: { type: "enum", values: ["web", "referral", "event", "cold_call", "partner", "ad"], label: "Source" },
      rating: { type: "enum", values: ["hot", "warm", "cold"], label: "Rating" },
      estimatedValue: { type: "number", label: "Est. Value" },
      ownerId: { type: "ref", ref: "User", label: "Owner" },
      ownerName: { type: "string", label: "Owner" },
      createdAt: { type: "date", label: "Created" },
      updatedAt: { type: "date", label: "Updated" },
    },
  },

  Account: {
    label: "Account",
    fields: {
      id: { type: "string" },
      name: { type: "string", label: "Name" },
      industry: { type: "enum", values: ["technology", "finance", "healthcare", "manufacturing", "retail", "energy", "media"], label: "Industry" },
      type: { type: "enum", values: ["prospect", "customer", "partner", "churned"], label: "Type" },
      tier: { type: "enum", values: ["enterprise", "mid_market", "smb"], label: "Tier" },
      annualRevenue: { type: "number", label: "Annual Revenue" },
      employees: { type: "number", label: "Employees" },
      website: { type: "string", label: "Website" },
      country: { type: "string", label: "Country" },
      ownerId: { type: "ref", ref: "User", label: "Owner" },
      ownerName: { type: "string", label: "Owner" },
      createdAt: { type: "date", label: "Created" },
    },
  },

  Contact: {
    label: "Contact",
    fields: {
      id: { type: "string" },
      name: { type: "string", label: "Name" },
      title: { type: "string", label: "Title" },
      email: { type: "string", label: "Email" },
      phone: { type: "string", label: "Phone" },
      department: { type: "string", label: "Department" },
      isPrimary: { type: "boolean", label: "Primary" },
      accountId: { type: "ref", ref: "Account", label: "Account" },
      accountName: { type: "string", label: "Account" },
      ownerId: { type: "ref", ref: "User", label: "Owner" },
      ownerName: { type: "string", label: "Owner" },
      createdAt: { type: "date", label: "Created" },
    },
  },

  Deal: {
    label: "Deal",
    fields: {
      id: { type: "string" },
      name: { type: "string", label: "Name" },
      stage: { type: "enum", values: ["prospecting", "qualification", "proposal", "negotiation", "closed_won", "closed_lost"], label: "Stage" },
      type: { type: "enum", values: ["new_business", "renewal", "upsell", "expansion"], label: "Type" },
      amount: { type: "number", label: "Amount" },
      probability: { type: "number", label: "Probability" },
      source: { type: "enum", values: ["web", "referral", "event", "cold_call", "partner", "ad"], label: "Source" },
      accountId: { type: "ref", ref: "Account", label: "Account" },
      accountName: { type: "string", label: "Account" },
      ownerId: { type: "ref", ref: "User", label: "Owner" },
      ownerName: { type: "string", label: "Owner" },
      closeDate: { type: "date", label: "Close Date" },
      createdAt: { type: "date", label: "Created" },
      updatedAt: { type: "date", label: "Updated" },
    },
  },

  Activity: {
    label: "Activity",
    fields: {
      id: { type: "string" },
      subject: { type: "string", label: "Subject" },
      type: { type: "enum", values: ["call", "email", "meeting", "task"], label: "Type" },
      status: { type: "enum", values: ["open", "completed", "cancelled"], label: "Status" },
      priority: { type: "enum", values: ["low", "normal", "high", "urgent"], label: "Priority" },
      dueAt: { type: "date", label: "Due" },
      relatedKind: { type: "enum", values: ["Lead", "Account", "Contact", "Deal", "Case"], label: "Related To" },
      relatedId: { type: "string", label: "Related Id" },
      relatedName: { type: "string", label: "Related" },
      ownerId: { type: "ref", ref: "User", label: "Owner" },
      ownerName: { type: "string", label: "Owner" },
      completedAt: { type: "date", label: "Completed" },
      createdAt: { type: "date", label: "Created" },
    },
  },

  Product: {
    label: "Product",
    fields: {
      id: { type: "string" },
      name: { type: "string", label: "Name" },
      sku: { type: "string", label: "SKU" },
      category: { type: "enum", values: ["platform", "addon", "service", "support_plan"], label: "Category" },
      unitPrice: { type: "number", label: "Unit Price" },
      active: { type: "boolean", label: "Active" },
      description: { type: "string", label: "Description" },
    },
  },

  Quote: {
    label: "Quote",
    fields: {
      id: { type: "string" },
      name: { type: "string", label: "Name" },
      status: { type: "enum", values: ["draft", "sent", "accepted", "rejected", "expired"], label: "Status" },
      totalAmount: { type: "number", label: "Total" },
      validUntil: { type: "date", label: "Valid Until" },
      dealId: { type: "ref", ref: "Deal", label: "Deal" },
      dealName: { type: "string", label: "Deal" },
      accountId: { type: "ref", ref: "Account", label: "Account" },
      accountName: { type: "string", label: "Account" },
      ownerId: { type: "ref", ref: "User", label: "Owner" },
      ownerName: { type: "string", label: "Owner" },
      createdAt: { type: "date", label: "Created" },
    },
  },

  Case: {
    label: "Case",
    fields: {
      id: { type: "string" },
      subject: { type: "string", label: "Subject" },
      status: { type: "enum", values: ["new", "in_progress", "waiting", "escalated", "closed"], label: "Status" },
      priority: { type: "enum", values: ["low", "normal", "high", "urgent"], label: "Priority" },
      type: { type: "enum", values: ["question", "problem", "feature_request", "incident"], label: "Type" },
      origin: { type: "enum", values: ["email", "phone", "web", "chat"], label: "Origin" },
      accountId: { type: "ref", ref: "Account", label: "Account" },
      accountName: { type: "string", label: "Account" },
      contactId: { type: "ref", ref: "Contact", label: "Contact" },
      contactName: { type: "string", label: "Contact" },
      ownerId: { type: "ref", ref: "User", label: "Owner" },
      ownerName: { type: "string", label: "Owner" },
      createdAt: { type: "date", label: "Created" },
      closedAt: { type: "date", label: "Closed" },
    },
  },

  Campaign: {
    label: "Campaign",
    fields: {
      id: { type: "string" },
      name: { type: "string", label: "Name" },
      type: { type: "enum", values: ["email", "event", "webinar", "paid_ads", "content"], label: "Type" },
      status: { type: "enum", values: ["planned", "active", "paused", "completed"], label: "Status" },
      budget: { type: "number", label: "Budget" },
      actualCost: { type: "number", label: "Actual Cost" },
      expectedRevenue: { type: "number", label: "Expected Revenue" },
      numLeads: { type: "number", label: "Leads" },
      startDate: { type: "date", label: "Start" },
      endDate: { type: "date", label: "End" },
      ownerId: { type: "ref", ref: "User", label: "Owner" },
      ownerName: { type: "string", label: "Owner" },
    },
  },
};
