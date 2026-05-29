import {
  type FluidIR,
  type FluidSchema,
  checkIRAgainstSchema,
  validateIR,
} from "@/fluid/core";
import { type DataContext } from "./data";
import { renderNode } from "./render";

interface FluidViewProps {
  ir: unknown;
  data: DataContext;
  /** Optional. When provided, IR is semantically checked against the schema. */
  schema?: FluidSchema;
}

export function FluidView({ ir, data, schema }: FluidViewProps) {
  let validated: FluidIR;
  try {
    validated = validateIR(ir);
    if (schema) checkIRAgainstSchema(validated, schema);
  } catch (err) {
    return (
      <div className="rounded-lg border border-rose-800 bg-rose-950/40 p-4 text-sm text-rose-200">
        <div className="font-medium mb-1">Invalid IR</div>
        <pre className="text-xs opacity-80 whitespace-pre-wrap">{String(err)}</pre>
      </div>
    );
  }
  return <>{renderNode(validated.root, data)}</>;
}

export { type DataContext } from "./data";
