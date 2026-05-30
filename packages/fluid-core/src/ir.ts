import { z } from "zod";

/**
 * Fluid IR (Intermediate Representation).
 *
 * A sandboxed JSON tree that the engine emits and the renderer consumes.
 * Layout primitives + data bindings only — no executable code, no raw HTML.
 */

const IdentifierSchema = z.string().regex(/^[a-zA-Z_][a-zA-Z0-9_.]*$/);

export const BindingSchema = z.object({
  kind: z.literal("binding"),
  entity: IdentifierSchema,
  field: IdentifierSchema.optional(),
  format: z.enum(["text", "date", "relative-date", "badge", "priority"]).optional(),
});
export type Binding = z.infer<typeof BindingSchema>;

export const QuerySchema = z.object({
  entity: IdentifierSchema,
  filter: z
    .object({
      field: IdentifierSchema,
      op: z.enum(["eq", "neq", "in", "gte", "lte"]),
      value: z.union([z.string(), z.number(), z.boolean(), z.array(z.string())]),
    })
    .optional(),
  groupBy: IdentifierSchema.optional(),
  sortBy: IdentifierSchema.optional(),
  limit: z.number().int().positive().optional(),
});
export type Query = z.infer<typeof QuerySchema>;

const BaseNode = {
  id: z.string().optional(),
  className: z.string().optional(),
};

export type IRNode =
  | StackNode
  | SplitNode
  | GridNode
  | KanbanNode
  | ListNode
  | CardNode
  | StatNode
  | HeadingNode
  | FieldNode
  | BadgeNode
  | ActionNode;

export interface StackNode {
  type: "stack";
  direction?: "row" | "col";
  gap?: "sm" | "md" | "lg";
  children: IRNode[];
  id?: string;
  className?: string;
}
export interface SplitNode {
  type: "split";
  ratio?: "1:1" | "2:1" | "3:1" | "1:2" | "1:3";
  left: IRNode;
  right: IRNode;
  id?: string;
  className?: string;
}
export interface GridNode {
  type: "grid";
  cols?: 2 | 3 | 4;
  children: IRNode[];
  id?: string;
  className?: string;
}
export interface KanbanNode {
  type: "kanban";
  query: Query;
  groupBy: string;
  columns: string[];
  card: CardNode;
  id?: string;
  className?: string;
}
export interface ListNode {
  type: "list";
  query: Query;
  variant?: "compact" | "comfortable";
  item: IRNode;
  emptyText?: string;
  groupHeader?: boolean;
  id?: string;
  className?: string;
}
export interface CardNode {
  type: "card";
  title?: Binding | string;
  subtitle?: Binding | string;
  fields?: FieldNode[];
  badges?: BadgeNode[];
  /** Interactive action buttons rendered at the bottom of the card. */
  actions?: ActionNode[];
  id?: string;
  className?: string;
}
export interface StatNode {
  type: "stat";
  label: string;
  query: Query;
  aggregate: "count" | "sum" | "countWhere";
  field?: string;
  whereField?: string;
  whereValue?: string | number;
  id?: string;
  className?: string;
}
export interface HeadingNode {
  type: "heading";
  text: string;
  level?: 1 | 2 | 3;
  id?: string;
  className?: string;
}
export interface FieldNode {
  type: "field";
  binding: Binding;
  label?: string;
  id?: string;
  className?: string;
}
export interface BadgeNode {
  type: "badge";
  binding: Binding;
  tone?: "neutral" | "info" | "success" | "warn" | "danger";
  id?: string;
  className?: string;
}

/**
 * Interactive button bound to a developer-declared mutation.
 *
 * `mutation` must match a key in the schema's `mutations` map.
 * `args` values are either literal scalars or Bindings resolved
 * from the current row context (e.g. the card's data record).
 */
export interface ActionNode {
  type: "action";
  /** Button label shown to the user. */
  label: string;
  /** Must match a key in schema.mutations. */
  mutation: string;
  /**
   * Argument values. Use a Binding to pull from the current row,
   * or a literal string/number/boolean.
   */
  args: Record<string, Binding | string | number | boolean>;
  style?: "primary" | "secondary" | "danger";
  /** If set, the renderer shows a confirm dialog before firing. */
  confirmText?: string;
  id?: string;
  className?: string;
}

const lazy = <T>(s: () => z.ZodType<T>) => z.lazy(s);

const BadgeNodeSchema: z.ZodType<BadgeNode> = z.object({
  type: z.literal("badge"),
  binding: BindingSchema,
  tone: z.enum(["neutral", "info", "success", "warn", "danger"]).optional(),
  ...BaseNode,
});

const FieldNodeSchema: z.ZodType<FieldNode> = z.object({
  type: z.literal("field"),
  binding: BindingSchema,
  label: z.string().optional(),
  ...BaseNode,
});

const CardNodeSchema: z.ZodType<CardNode> = z.object({
  type: z.literal("card"),
  title: z.union([BindingSchema, z.string()]).optional(),
  subtitle: z.union([BindingSchema, z.string()]).optional(),
  fields: z.array(FieldNodeSchema).optional(),
  badges: z.array(BadgeNodeSchema).optional(),
  actions: z.array(z.lazy(() => ActionNodeSchema)).optional(),
  ...BaseNode,
});

const HeadingNodeSchema: z.ZodType<HeadingNode> = z.object({
  type: z.literal("heading"),
  text: z.string(),
  level: z.union([z.literal(1), z.literal(2), z.literal(3)]).optional(),
  ...BaseNode,
});

const StatNodeSchema: z.ZodType<StatNode> = z.object({
  type: z.literal("stat"),
  label: z.string(),
  query: QuerySchema,
  aggregate: z.enum(["count", "sum", "countWhere"]),
  field: z.string().optional(),
  whereField: z.string().optional(),
  whereValue: z.union([z.string(), z.number()]).optional(),
  ...BaseNode,
});

const NodeSchema: z.ZodType<IRNode> = lazy(() =>
  z.union([
    StackNodeSchema,
    SplitNodeSchema,
    GridNodeSchema,
    KanbanNodeSchema,
    ListNodeSchema,
    CardNodeSchema,
    StatNodeSchema,
    HeadingNodeSchema,
    FieldNodeSchema,
    BadgeNodeSchema,
    ActionNodeSchema,
  ]),
);

const ActionNodeSchema: z.ZodType<ActionNode> = z.object({
  type: z.literal("action"),
  label: z.string(),
  mutation: IdentifierSchema,
  args: z.record(
    z.string(),
    z.union([BindingSchema, z.string(), z.number(), z.boolean()]),
  ),
  style: z.enum(["primary", "secondary", "danger"]).optional(),
  confirmText: z.string().optional(),
  ...BaseNode,
});

const StackNodeSchema: z.ZodType<StackNode> = z.object({
  type: z.literal("stack"),
  direction: z.enum(["row", "col"]).optional(),
  gap: z.enum(["sm", "md", "lg"]).optional(),
  children: z.array(NodeSchema),
  ...BaseNode,
});

const SplitNodeSchema: z.ZodType<SplitNode> = z.object({
  type: z.literal("split"),
  ratio: z.enum(["1:1", "2:1", "3:1", "1:2", "1:3"]).optional(),
  left: NodeSchema,
  right: NodeSchema,
  ...BaseNode,
});

const GridNodeSchema: z.ZodType<GridNode> = z.object({
  type: z.literal("grid"),
  cols: z.union([z.literal(2), z.literal(3), z.literal(4)]).optional(),
  children: z.array(NodeSchema),
  ...BaseNode,
});

const KanbanNodeSchema: z.ZodType<KanbanNode> = z.object({
  type: z.literal("kanban"),
  query: QuerySchema,
  groupBy: z.string(),
  columns: z.array(z.string()),
  card: CardNodeSchema,
  ...BaseNode,
});

const ListNodeSchema: z.ZodType<ListNode> = z.object({
  type: z.literal("list"),
  query: QuerySchema,
  variant: z.enum(["compact", "comfortable"]).optional(),
  item: NodeSchema,
  emptyText: z.string().optional(),
  groupHeader: z.boolean().optional(),
  ...BaseNode,
});

export const FluidIRSchema = z.object({
  version: z.literal(1),
  archetype: z.string(),
  schema: z.string(),
  root: NodeSchema,
});
export type FluidIR = z.infer<typeof FluidIRSchema>;

export function validateIR(input: unknown): FluidIR {
  return FluidIRSchema.parse(input);
}
