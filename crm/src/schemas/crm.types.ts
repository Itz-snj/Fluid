/**
 * CRM entity row types.
 *
 * These are the concrete shapes the endpoints return and the renderer reads.
 *
 * Denormalization note:
 *   The Fluid renderer (@fluid/react `runQuery` / `resolveBinding`) reads only
 *   scalar fields off a SINGLE entity's rows — it never joins entities. So
 *   every relationship is stored two ways:
 *     - `<rel>Id`   — the foreign key, declared as a `ref` field in the schema.
 *                     This documents the true data model for the LLM.
 *     - `<rel>Name` — a denormalized display string the renderer can bind to
 *                     directly without a join.
 *   Keep the two in sync inside mutation handlers.
 *
 * All dates are ISO `YYYY-MM-DD` strings so the date-aware comparator in
 * `runQuery` sorts them correctly.
 */

export type Role = "sales_rep" | "sales_manager" | "support_agent" | "admin";

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  team: string;
  active: boolean;
}

export type LeadStatus =
  | "new"
  | "contacted"
  | "qualified"
  | "unqualified"
  | "converted";
export type LeadSource =
  | "web"
  | "referral"
  | "event"
  | "cold_call"
  | "partner"
  | "ad";
export type Rating = "hot" | "warm" | "cold";

export interface Lead {
  id: string;
  name: string;
  company: string;
  email: string;
  phone: string;
  title: string;
  status: LeadStatus;
  source: LeadSource;
  rating: Rating;
  estimatedValue: number;
  ownerId: string;
  ownerName: string;
  createdAt: string;
  updatedAt: string;
}

export type AccountType = "prospect" | "customer" | "partner" | "churned";
export type Industry =
  | "technology"
  | "finance"
  | "healthcare"
  | "manufacturing"
  | "retail"
  | "energy"
  | "media";
export type Tier = "enterprise" | "mid_market" | "smb";

export interface Account {
  id: string;
  name: string;
  industry: Industry;
  type: AccountType;
  tier: Tier;
  annualRevenue: number;
  employees: number;
  website: string;
  country: string;
  ownerId: string;
  ownerName: string;
  createdAt: string;
}

export interface Contact {
  id: string;
  name: string;
  title: string;
  email: string;
  phone: string;
  department: string;
  isPrimary: boolean;
  accountId: string;
  accountName: string;
  ownerId: string;
  ownerName: string;
  createdAt: string;
}

export type DealStage =
  | "prospecting"
  | "qualification"
  | "proposal"
  | "negotiation"
  | "closed_won"
  | "closed_lost";
export type DealType = "new_business" | "renewal" | "upsell" | "expansion";

export interface Deal {
  id: string;
  name: string;
  stage: DealStage;
  type: DealType;
  amount: number;
  probability: number;
  source: LeadSource;
  accountId: string;
  accountName: string;
  ownerId: string;
  ownerName: string;
  closeDate: string;
  createdAt: string;
  updatedAt: string;
}

export type ActivityType = "call" | "email" | "meeting" | "task";
export type ActivityStatus = "open" | "completed" | "cancelled";
export type Priority = "low" | "normal" | "high" | "urgent";
export type RelatedKind = "Lead" | "Account" | "Contact" | "Deal" | "Case";

export interface Activity {
  id: string;
  subject: string;
  type: ActivityType;
  status: ActivityStatus;
  priority: Priority;
  dueAt: string;
  relatedKind: RelatedKind;
  relatedId: string;
  relatedName: string;
  ownerId: string;
  ownerName: string;
  completedAt: string;
  createdAt: string;
}

export type ProductCategory =
  | "platform"
  | "addon"
  | "service"
  | "support_plan";

export interface Product {
  id: string;
  name: string;
  sku: string;
  category: ProductCategory;
  unitPrice: number;
  active: boolean;
  description: string;
}

export type QuoteStatus = "draft" | "sent" | "accepted" | "rejected" | "expired";

export interface Quote {
  id: string;
  name: string;
  status: QuoteStatus;
  totalAmount: number;
  validUntil: string;
  dealId: string;
  dealName: string;
  accountId: string;
  accountName: string;
  ownerId: string;
  ownerName: string;
  createdAt: string;
}

export type CaseStatus =
  | "new"
  | "in_progress"
  | "waiting"
  | "escalated"
  | "closed";
export type CaseType = "question" | "problem" | "feature_request" | "incident";
export type CaseOrigin = "email" | "phone" | "web" | "chat";

export interface Case {
  id: string;
  subject: string;
  status: CaseStatus;
  priority: Priority;
  type: CaseType;
  origin: CaseOrigin;
  accountId: string;
  accountName: string;
  contactId: string;
  contactName: string;
  ownerId: string;
  ownerName: string;
  createdAt: string;
  closedAt: string;
}

export type CampaignType =
  | "email"
  | "event"
  | "webinar"
  | "paid_ads"
  | "content";
export type CampaignStatus = "planned" | "active" | "paused" | "completed";

export interface Campaign {
  id: string;
  name: string;
  type: CampaignType;
  status: CampaignStatus;
  budget: number;
  actualCost: number;
  expectedRevenue: number;
  numLeads: number;
  startDate: string;
  endDate: string;
  ownerId: string;
  ownerName: string;
}
