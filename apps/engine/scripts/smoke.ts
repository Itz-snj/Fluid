import { lawyerIR } from "@/archetypes/lawyer.ir";
import { engineerIR } from "@/archetypes/engineer.ir";
import { pmIR } from "@/archetypes/pm.ir";
import { taskSchema } from "@/schemas/tasks.fluid";
import { checkIRAgainstSchema, validateIR } from "@fluid/core";

const cases: [string, unknown][] = [
  ["lawyer", lawyerIR],
  ["engineer", engineerIR],
  ["pm", pmIR],
];

let ok = true;
for (const [name, ir] of cases) {
  try {
    const v = validateIR(ir);
    checkIRAgainstSchema(v, taskSchema);
    console.log(`OK  ${name}`);
  } catch (e) {
    ok = false;
    console.log(`FAIL ${name}: ${(e as Error).message}`);
  }
}
process.exit(ok ? 0 : 1);
