import type { ReactNode } from "react";
import type {
  ActionNode,
  BadgeNode,
  CardNode,
  FieldNode,
  GridNode,
  HeadingNode,
  IRNode,
  KanbanNode,
  ListNode,
  SplitNode,
  StackNode,
  StatNode,
} from "@fluid/core";
import { type DataContext, groupRows, resolveBinding, runQuery } from "./data";

const gapMap = { sm: "gap-2", md: "gap-4", lg: "gap-6" } as const;
const ratioMap: Record<NonNullable<SplitNode["ratio"]>, string> = {
  "1:1": "grid-cols-2",
  "2:1": "grid-cols-[2fr_1fr]",
  "3:1": "grid-cols-[3fr_1fr]",
  "1:2": "grid-cols-[1fr_2fr]",
  "1:3": "grid-cols-[1fr_3fr]",
};
const colsMap = { 2: "grid-cols-2", 3: "grid-cols-3", 4: "grid-cols-4" } as const;
const toneMap: Record<NonNullable<BadgeNode["tone"]>, string> = {
  neutral: "bg-zinc-800 text-zinc-200 ring-zinc-700",
  info: "bg-blue-950/60 text-blue-200 ring-blue-800",
  success: "bg-emerald-950/60 text-emerald-200 ring-emerald-800",
  warn: "bg-amber-950/60 text-amber-200 ring-amber-800",
  danger: "bg-rose-950/60 text-rose-200 ring-rose-800",
};
const actionStyleMap: Record<NonNullable<ActionNode["style"]>, string> = {
  primary: "bg-blue-600 hover:bg-blue-500 text-white",
  secondary: "bg-zinc-700 hover:bg-zinc-600 text-zinc-200",
  danger: "bg-rose-600 hover:bg-rose-500 text-white",
};

function priorityTone(p: string): NonNullable<BadgeNode["tone"]> {
  if (p === "p0" || p === "P0") return "danger";
  if (p === "p1" || p === "P1") return "warn";
  if (p === "p2" || p === "P2") return "info";
  return "neutral";
}

export function renderNode(node: IRNode, ctx: DataContext, row?: Record<string, unknown>): ReactNode {
  switch (node.type) {
    case "stack":
      return renderStack(node, ctx, row);
    case "split":
      return renderSplit(node, ctx, row);
    case "grid":
      return renderGrid(node, ctx, row);
    case "kanban":
      return renderKanban(node, ctx);
    case "list":
      return renderList(node, ctx);
    case "card":
      return renderCard(node, row);
    case "stat":
      return renderStat(node, ctx);
    case "heading":
      return renderHeading(node);
    case "field":
      return renderField(node, row);
    case "badge":
      return renderBadge(node, row);
    case "action":
      return renderAction(node, row);
  }
}

function rowKey(r: Record<string, unknown>, i: number): string {
  const id = r.id;
  if (typeof id === "string" || typeof id === "number") return String(id);
  return `row-${i}`;
}

function renderStack(node: StackNode, ctx: DataContext, row?: Record<string, unknown>) {
  const dir = node.direction === "row" ? "flex-row" : "flex-col";
  const gap = gapMap[node.gap ?? "md"];
  return (
    <div
      key={node.id}
      className={`flex ${dir} ${gap} ${node.className ?? ""}`}
      data-fluid-node="stack"
      data-fluid-id={node.id}
    >
      {node.children.map((c, i) => (
        <div key={c.id ?? i}>{renderNode(c, ctx, row)}</div>
      ))}
    </div>
  );
}

function renderSplit(node: SplitNode, ctx: DataContext, row?: Record<string, unknown>) {
  const cols = ratioMap[node.ratio ?? "1:1"];
  return (
    <div
      key={node.id}
      className={`grid ${cols} gap-4 ${node.className ?? ""}`}
      data-fluid-node="split"
      data-fluid-id={node.id}
    >
      <div className="min-w-0">{renderNode(node.left, ctx, row)}</div>
      <div className="min-w-0">{renderNode(node.right, ctx, row)}</div>
    </div>
  );
}

function renderGrid(node: GridNode, ctx: DataContext, row?: Record<string, unknown>) {
  const cols = colsMap[node.cols ?? 3];
  return (
    <div
      key={node.id}
      className={`grid ${cols} gap-4 ${node.className ?? ""}`}
      data-fluid-node="grid"
      data-fluid-id={node.id}
    >
      {node.children.map((c, i) => (
        <div key={c.id ?? i}>{renderNode(c, ctx, row)}</div>
      ))}
    </div>
  );
}

function renderHeading(node: HeadingNode) {
  const level = node.level ?? 2;
  const cls =
    level === 1 ? "text-2xl font-semibold tracking-tight"
    : level === 2 ? "text-lg font-semibold tracking-tight"
    : "text-sm font-medium uppercase tracking-wider text-zinc-400";
  return (
    <h2
      key={node.id}
      className={`${cls} ${node.className ?? ""}`}
      data-fluid-node="heading"
      data-fluid-id={node.id}
    >
      {node.text}
    </h2>
  );
}

function renderField(node: FieldNode, row?: Record<string, unknown>) {
  const value = resolveBinding(node.binding, row);
  return (
    <div
      key={node.id}
      className={`text-sm ${node.className ?? ""}`}
      data-fluid-node="field"
      data-fluid-id={node.id}
      data-fluid-entity={node.binding.entity}
    >
      {node.label && <span className="text-zinc-500 mr-1">{node.label}:</span>}
      <span className="text-zinc-200">{value}</span>
    </div>
  );
}

function renderBadge(node: BadgeNode, row?: Record<string, unknown>) {
  const value = resolveBinding(node.binding, row);
  const tone =
    node.tone ?? (node.binding.format === "priority" ? priorityTone(value) : "neutral");
  return (
    <span
      key={node.id}
      className={`inline-flex items-center rounded-md px-1.5 py-0.5 text-xs font-medium ring-1 ring-inset ${toneMap[tone]} ${node.className ?? ""}`}
      data-fluid-node="badge"
      data-fluid-id={node.id}
      data-fluid-entity={node.binding.entity}
    >
      {value}
    </span>
  );
}

/**
 * Renders a mutation button.
 *
 * The button carries all the data it needs in data-* attributes.
 * Interactivity (click handling, confirm dialog, fetch) is handled by the
 * `useMutations` hook, which attaches a delegated listener to `document`.
 * This keeps FluidView server-safe — no onClick handlers here.
 */
function renderAction(node: ActionNode, row?: Record<string, unknown>) {
  // Resolve binding args against the current row; leave literals as-is.
  const resolvedArgs: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(node.args)) {
    if (typeof val === "object" && val !== null && "kind" in val) {
      resolvedArgs[key] = resolveBinding(val, row);
    } else {
      resolvedArgs[key] = val;
    }
  }

  const styleCls = actionStyleMap[node.style ?? "secondary"];
  return (
    <button
      key={node.id}
      type="button"
      className={`px-3 py-1 text-xs font-medium rounded-md transition ${styleCls} ${node.className ?? ""}`}
      data-fluid-node="action"
      data-fluid-id={node.id}
      data-fluid-mutation={node.mutation}
      data-fluid-args={JSON.stringify(resolvedArgs)}
      data-fluid-confirm={node.confirmText ?? undefined}
    >
      {node.label}
    </button>
  );
}

function renderCard(node: CardNode, row?: Record<string, unknown>) {
  return (
    <div
      className={`rounded-lg border border-zinc-800 bg-zinc-950/60 p-3 hover:border-zinc-700 transition ${node.className ?? ""}`}
      data-fluid-node="card"
      data-fluid-id={node.id}
      data-fluid-entity={
        typeof node.title === "object" && node.title !== null && "entity" in node.title
          ? node.title.entity
          : undefined
      }
    >
      {node.title && (
        <div className="text-sm font-medium text-zinc-100 mb-1">
          {resolveBinding(node.title, row)}
        </div>
      )}
      {node.subtitle && (
        <div className="text-xs text-zinc-500 mb-2">{resolveBinding(node.subtitle, row)}</div>
      )}
      {node.badges && node.badges.length > 0 && (
        <div className="flex gap-1 flex-wrap mb-2">
          {node.badges.map((b, i) => (
            <span key={i}>{renderBadge(b, row)}</span>
          ))}
        </div>
      )}
      {node.fields && node.fields.length > 0 && (
        <div className="flex flex-col gap-0.5">
          {node.fields.map((f, i) => (
            <span key={i}>{renderField(f, row)}</span>
          ))}
        </div>
      )}
      {node.actions && node.actions.length > 0 && (
        <div className="flex gap-2 mt-2 pt-2 border-t border-zinc-800/60">
          {node.actions.map((a, i) => (
            <span key={i}>{renderAction(a, row)}</span>
          ))}
        </div>
      )}
    </div>
  );
}

function renderStat(node: StatNode, ctx: DataContext) {
  const rows = (ctx[node.query.entity] ?? []) as Record<string, unknown>[];
  const filtered = runQuery(rows, node.query);
  let value: number | string = 0;
  if (node.aggregate === "count") value = filtered.length;
  else if (node.aggregate === "countWhere") {
    value = filtered.filter((r) => r[node.whereField ?? ""] === node.whereValue).length;
  } else if (node.aggregate === "sum") {
    value = filtered.reduce((acc, r) => acc + Number(r[node.field ?? ""] ?? 0), 0);
  }
  return (
    <div
      className={`rounded-lg border border-zinc-800 bg-zinc-950/60 p-4 ${node.className ?? ""}`}
      data-fluid-node="stat"
      data-fluid-id={node.id}
      data-fluid-entity={node.query.entity}
    >
      <div className="text-xs uppercase tracking-wider text-zinc-500">{node.label}</div>
      <div className="text-3xl font-semibold tabular-nums text-zinc-100 mt-1">{value}</div>
    </div>
  );
}

function renderList(node: ListNode, ctx: DataContext) {
  const rows = (ctx[node.query.entity] ?? []) as Record<string, unknown>[];
  const data = runQuery(rows, node.query);
  if (data.length === 0) {
    return <div className="text-sm text-zinc-500 italic">{node.emptyText ?? "Nothing here."}</div>;
  }
  if (node.query.groupBy && node.groupHeader) {
    const groups = groupRows(data, node.query.groupBy);
    return (
      <div
        className={`flex flex-col gap-4 ${node.className ?? ""}`}
        data-fluid-node="list"
        data-fluid-id={node.id}
        data-fluid-entity={node.query.entity}
      >
        {Object.entries(groups).map(([key, items]) => (
          <div key={key}>
            <div className="text-xs uppercase tracking-wider text-zinc-500 mb-2">{key}</div>
            <div className={`flex flex-col ${node.variant === "compact" ? "gap-1" : "gap-2"}`}>
              {items.map((r, i) => (
                <div key={rowKey(r, i)}>{renderNode(node.item, ctx, r)}</div>
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  }
  return (
    <div
      className={`flex flex-col ${node.variant === "compact" ? "gap-1" : "gap-2"} ${node.className ?? ""}`}
      data-fluid-node="list"
      data-fluid-id={node.id}
      data-fluid-entity={node.query.entity}
    >
      {data.map((r, i) => (
        <div key={rowKey(r, i)}>{renderNode(node.item, ctx, r)}</div>
      ))}
    </div>
  );
}

function renderKanban(node: KanbanNode, ctx: DataContext) {
  const rows = (ctx[node.query.entity] ?? []) as Record<string, unknown>[];
  const data = runQuery(rows, node.query);
  const groups = groupRows(data, node.groupBy);
  return (
    <div
      className={`grid gap-3 ${node.className ?? ""}`}
      style={{ gridTemplateColumns: `repeat(${node.columns.length}, minmax(0, 1fr))` }}
      data-fluid-node="kanban"
      data-fluid-id={node.id}
      data-fluid-entity={node.query.entity}
    >
      {node.columns.map((col) => (
        <div key={col} className="rounded-lg bg-zinc-900/40 border border-zinc-800 p-3 min-h-[300px]">
          <div className="flex items-center justify-between mb-3">
            <div className="text-xs font-medium uppercase tracking-wider text-zinc-400">{col.replace(/_/g, " ")}</div>
            <span className="text-xs tabular-nums text-zinc-500">{(groups[col] ?? []).length}</span>
          </div>
          <div className="flex flex-col gap-2">
            {(groups[col] ?? []).map((r, i) => (
              <div key={rowKey(r, i)}>{renderCard(node.card, r)}</div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
