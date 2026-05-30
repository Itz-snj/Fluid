import { z } from "zod";

/**
 * .fluid.ts schema runtime types.
 *
 * A Fluid schema declares:
 *   - entities: shape of records (id, fields)
 *   - endpoints: how the renderer fetches data for a query
 *
 * The IR can only reference entities and fields declared here. Validation
 * against this is the sandbox boundary between LLM output and the renderer.
 */

export type FieldType = "string" | "number" | "boolean" | "date" | "enum" | "ref";

export interface FieldDef {
  type: FieldType;
  values?: string[];
  ref?: string;
  label?: string;
}

export interface EntityDef {
  fields: Record<string, FieldDef>;
  label?: string;
}

export interface EndpointDef<T = unknown> {
  entity: string;
  fetch: () => Promise<T[]> | T[];
}

export interface FluidSchema {
  name: string;
  entities: Record<string, EntityDef>;
  endpoints: Record<string, EndpointDef>;
}

export function defineSchema<S extends FluidSchema>(schema: S): S {
  return schema;
}

export const FieldDefRuntimeSchema = z.object({
  type: z.enum(["string", "number", "boolean", "date", "enum", "ref"]),
  values: z.array(z.string()).optional(),
  ref: z.string().optional(),
  label: z.string().optional(),
});

export const EntityDefRuntimeSchema = z.object({
  fields: z.record(z.string(), FieldDefRuntimeSchema),
  label: z.string().optional(),
});
