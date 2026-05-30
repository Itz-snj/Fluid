import { salesRepIR } from "@/archetypes/sales-rep.ir";
import { salesManagerIR } from "@/archetypes/sales-manager.ir";
import { supportAgentIR } from "@/archetypes/support-agent.ir";
import { crmSchema } from "@/schemas/crm.fluid";
import { checkIRAgainstSchema, validateIR } from "@fluid/core";

/**
 * Smoke test: prove every preset archetype is a valid IR that resolves against
 * the CRM schema, and that the schema's endpoints/mutations reference only
 * declared entities. Run with `bun run scripts/smoke.ts`. Exit 1 on any failure
 * so CI catches a grammar regression the moment a node type or field changes.
 */

const cases: [string, unknown][] = [
  ["sales_rep", salesRepIR],
  ["sales_manager", salesManagerIR],
  ["support_agent", supportAgentIR],
];

let ok = true;

for (const [name, ir] of cases) {
  try {
    const v = validateIR(ir);
    checkIRAgainstSchema(v, crmSchema);
    console.log(`OK   archetype ${name}`);
  } catch (e) {
    ok = false;
    console.log(`FAIL archetype ${name}: ${(e as Error).message}`);
  }
}

// Endpoint integrity — every endpoint's entity must be declared.
for (const [key, ep] of Object.entries(crmSchema.endpoints)) {
  if (!crmSchema.entities[ep.entity]) {
    ok = false;
    console.log(`FAIL endpoint ${key}: unknown entity "${ep.entity}"`);
  }
}

// Mutation integrity — every mutation's entity must be declared.
for (const [key, m] of Object.entries(crmSchema.mutations ?? {})) {
  if (!crmSchema.entities[m.entity]) {
    ok = false;
    console.log(`FAIL mutation ${key}: unknown entity "${m.entity}"`);
  }
}

const entityCount = Object.keys(crmSchema.entities).length;
const mutationCount = Object.keys(crmSchema.mutations ?? {}).length;
console.log(
  `\n${entityCount} entities · ${Object.keys(crmSchema.endpoints).length} endpoints · ${mutationCount} mutations`,
);

process.exit(ok ? 0 : 1);
