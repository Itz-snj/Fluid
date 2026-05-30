import type { Product } from "../schemas/crm.types";

/** The product catalog. Quotes reference these; unitPrice is numeric for sums. */
export const products: Product[] = [
  { id: "p1", name: "Northwind Platform — Core", sku: "NW-CORE", category: "platform", unitPrice: 1200, active: true, description: "Per-seat annual license for the core CRM platform." },
  { id: "p2", name: "Analytics Add-on", sku: "NW-ANALYTICS", category: "addon", unitPrice: 480, active: true, description: "Advanced reporting and forecasting module." },
  { id: "p3", name: "API & Integrations", sku: "NW-API", category: "addon", unitPrice: 360, active: true, description: "REST/webhook access and prebuilt connectors." },
  { id: "p4", name: "Premier Support", sku: "NW-SUP-PREM", category: "support_plan", unitPrice: 9000, active: true, description: "24/7 support with 1-hour response SLA." },
  { id: "p5", name: "Standard Support", sku: "NW-SUP-STD", category: "support_plan", unitPrice: 3000, active: true, description: "Business-hours support with next-day SLA." },
  { id: "p6", name: "Implementation Services", sku: "NW-IMPL", category: "service", unitPrice: 15000, active: true, description: "Guided onboarding and data migration." },
  { id: "p7", name: "Security & Compliance Pack", sku: "NW-SEC", category: "addon", unitPrice: 720, active: true, description: "SSO, audit logs, and SOC2 controls." },
  { id: "p8", name: "Legacy Connector", sku: "NW-LEGACY", category: "addon", unitPrice: 240, active: false, description: "Deprecated connector for v1 APIs." },
];

export const productById = (id: string): Product | undefined =>
  products.find((p) => p.id === id);
