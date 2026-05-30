import type { FluidIR, IRNode, Binding, Query } from "./ir";
import type { FluidSchema } from "./schema";

/**
 * Semantic validation: every entity/field/enum reference in the IR must
 * resolve against the developer's schema. This is the real sandbox boundary —
 * Zod proves shape, this proves the IR can't address data the developer didn't
 * declare.
 *
 * Also enforces structural limits (depth, node count) so a malicious or
 * runaway IR can't blow up the renderer.
 */

export const IR_LIMITS = {
  maxDepth: 16,
  maxNodes: 256,
} as const;

export class IRSemanticError extends Error {
  constructor(message: string, readonly path: string) {
    super(`${message} (at ${path})`);
    this.name = "IRSemanticError";
  }
}

export function checkIRAgainstSchema(ir: FluidIR, schema: FluidSchema): void {
  if (ir.schema !== schema.name) {
    throw new IRSemanticError(
      `IR.schema "${ir.schema}" does not match expected "${schema.name}"`,
      "$.schema",
    );
  }
  const ctx: WalkCtx = { schema, depth: 0, count: 0 };
  walkNode(ir.root, ctx, "$.root");
}

interface WalkCtx {
  schema: FluidSchema;
  depth: number;
  count: number;
}

function walkNode(node: IRNode, ctx: WalkCtx, path: string): void {
  ctx.count += 1;
  ctx.depth += 1;
  if (ctx.count > IR_LIMITS.maxNodes) {
    throw new IRSemanticError(`IR exceeds maxNodes (${IR_LIMITS.maxNodes})`, path);
  }
  if (ctx.depth > IR_LIMITS.maxDepth) {
    throw new IRSemanticError(`IR exceeds maxDepth (${IR_LIMITS.maxDepth})`, path);
  }

  switch (node.type) {
    case "stack":
      node.children.forEach((c, i) => walkNode(c, ctx, `${path}.children[${i}]`));
      break;
    case "split":
      walkNode(node.left, ctx, `${path}.left`);
      walkNode(node.right, ctx, `${path}.right`);
      break;
    case "grid":
      node.children.forEach((c, i) => walkNode(c, ctx, `${path}.children[${i}]`));
      break;
    case "list":
      checkQuery(node.query, ctx.schema, `${path}.query`);
      walkNode(node.item, ctx, `${path}.item`);
      break;
    case "kanban":
      checkQuery(node.query, ctx.schema, `${path}.query`);
      checkField(node.query.entity, node.groupBy, ctx.schema, `${path}.groupBy`);
      checkEnumValues(node.query.entity, node.groupBy, node.columns, ctx.schema, `${path}.columns`);
      walkNode(node.card, ctx, `${path}.card`);
      break;
    case "card":
      if (node.title && typeof node.title !== "string") {
        checkBinding(node.title, ctx.schema, `${path}.title`);
      }
      if (node.subtitle && typeof node.subtitle !== "string") {
        checkBinding(node.subtitle, ctx.schema, `${path}.subtitle`);
      }
      node.fields?.forEach((f, i) => walkNode(f, ctx, `${path}.fields[${i}]`));
      node.badges?.forEach((b, i) => walkNode(b, ctx, `${path}.badges[${i}]`));
      node.actions?.forEach((a, i) => walkNode(a, ctx, `${path}.actions[${i}]`));
      break;
    case "stat":
      checkQuery(node.query, ctx.schema, `${path}.query`);
      if (node.aggregate === "sum") {
        if (!node.field) {
          throw new IRSemanticError(`stat.aggregate=sum requires field`, path);
        }
        checkField(node.query.entity, node.field, ctx.schema, `${path}.field`);
      }
      if (node.aggregate === "countWhere") {
        if (!node.whereField) {
          throw new IRSemanticError(`stat.aggregate=countWhere requires whereField`, path);
        }
        checkField(node.query.entity, node.whereField, ctx.schema, `${path}.whereField`);
      }
      break;
    case "field":
      checkBinding(node.binding, ctx.schema, `${path}.binding`);
      break;
    case "badge":
      checkBinding(node.binding, ctx.schema, `${path}.binding`);
      break;
    case "action": {
      // Verify the mutation name is declared in the schema.
      if (!ctx.schema.mutations?.[node.mutation]) {
        throw new IRSemanticError(
          `unknown mutation "${node.mutation}" — not declared in schema.mutations`,
          `${path}.mutation`,
        );
      }
      // Validate any binding-typed args (literal scalars need no check).
      for (const [argName, argVal] of Object.entries(node.args)) {
        if (
          typeof argVal === "object" &&
          argVal !== null &&
          "kind" in argVal
        ) {
          checkBinding(
            argVal as import("./ir").Binding,
            ctx.schema,
            `${path}.args.${argName}`,
          );
        }
      }
      break;
    }
    case "heading":
      break;
  }

  ctx.depth -= 1;
}

function checkBinding(binding: Binding, schema: FluidSchema, path: string): void {
  const entity = schema.entities[binding.entity];
  if (!entity) {
    throw new IRSemanticError(`unknown entity "${binding.entity}"`, path);
  }
  if (binding.field !== undefined && !(binding.field in entity.fields)) {
    throw new IRSemanticError(
      `unknown field "${binding.field}" on entity "${binding.entity}"`,
      path,
    );
  }
}

function checkQuery(query: Query, schema: FluidSchema, path: string): void {
  const entity = schema.entities[query.entity];
  if (!entity) {
    throw new IRSemanticError(`unknown entity "${query.entity}"`, path);
  }
  if (query.filter) {
    checkField(query.entity, query.filter.field, schema, `${path}.filter.field`);
  }
  if (query.groupBy) {
    checkField(query.entity, query.groupBy, schema, `${path}.groupBy`);
  }
  if (query.sortBy) {
    checkField(query.entity, query.sortBy, schema, `${path}.sortBy`);
  }
}

function checkField(
  entityName: string,
  field: string,
  schema: FluidSchema,
  path: string,
): void {
  const entity = schema.entities[entityName];
  if (!entity) {
    throw new IRSemanticError(`unknown entity "${entityName}"`, path);
  }
  if (!(field in entity.fields)) {
    throw new IRSemanticError(
      `unknown field "${field}" on entity "${entityName}"`,
      path,
    );
  }
}

function checkEnumValues(
  entityName: string,
  field: string,
  values: string[],
  schema: FluidSchema,
  path: string,
): void {
  const def = schema.entities[entityName]?.fields[field];
  if (!def) return;
  if (def.type !== "enum" || !def.values) return;
  const allowed = new Set(def.values);
  for (const v of values) {
    if (!allowed.has(v)) {
      throw new IRSemanticError(
        `value "${v}" not in declared enum [${def.values.join(", ")}] for ${entityName}.${field}`,
        path,
      );
    }
  }
}
