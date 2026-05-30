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

/* ── Design tokens (inline — works in any app) ─────────────── */
const T = {
  bg:          "rgba(255,255,255,0.03)",
  bgHover:     "rgba(255,255,255,0.055)",
  border:      "rgba(255,255,255,0.07)",
  borderHover: "rgba(99,102,241,0.35)",
  text1:       "rgba(255,255,255,0.92)",
  text2:       "rgba(255,255,255,0.5)",
  text3:       "rgba(255,255,255,0.28)",
  accent:      "#6366f1",
  accent2:     "#8b5cf6",
  accent3:     "#a855f7",
  radius:      "12px",
  radiusSm:    "8px",
  radiusLg:    "16px",
};

const gapPx: Record<string, string> = { sm: "8px", md: "16px", lg: "24px" };
const ratioMap: Record<string, string> = {
  "1:1": "1fr 1fr",
  "2:1": "2fr 1fr",
  "3:1": "3fr 1fr",
  "1:2": "1fr 2fr",
  "1:3": "1fr 3fr",
};

/* ── Badge tones ────────────────────────────────────────────── */
const toneBg: Record<string, string> = {
  neutral: "rgba(255,255,255,0.08)",
  info:    "rgba(59,130,246,0.15)",
  success: "rgba(16,185,129,0.15)",
  warn:    "rgba(245,158,11,0.15)",
  danger:  "rgba(244,63,94,0.15)",
};
const toneColor: Record<string, string> = {
  neutral: "rgba(255,255,255,0.6)",
  info:    "#93c5fd",
  success: "#6ee7b7",
  warn:    "#fcd34d",
  danger:  "#fda4af",
};
const toneRing: Record<string, string> = {
  neutral: "rgba(255,255,255,0.1)",
  info:    "rgba(59,130,246,0.3)",
  success: "rgba(16,185,129,0.3)",
  warn:    "rgba(245,158,11,0.3)",
  danger:  "rgba(244,63,94,0.3)",
};

function priorityTone(p: string): NonNullable<BadgeNode["tone"]> {
  const lp = p?.toLowerCase?.() ?? "";
  if (lp === "p0" || lp === "critical") return "danger";
  if (lp === "p1" || lp === "high")     return "warn";
  if (lp === "p2" || lp === "medium")   return "info";
  return "neutral";
}

/* ── Node dispatcher ────────────────────────────────────────── */
export function renderNode(node: IRNode, ctx: DataContext, row?: Record<string, unknown>): ReactNode {
  switch (node.type) {
    case "stack":   return renderStack(node, ctx, row);
    case "split":   return renderSplit(node, ctx, row);
    case "grid":    return renderGrid(node, ctx, row);
    case "kanban":  return renderKanban(node, ctx);
    case "list":    return renderList(node, ctx);
    case "card":    return renderCard(node, row);
    case "stat":    return renderStat(node, ctx);
    case "heading": return renderHeading(node);
    case "field":   return renderField(node, row);
    case "badge":   return renderBadge(node, row);
    case "action":  return renderAction(node, row);
  }
}

function rowKey(r: Record<string, unknown>, i: number): string {
  const id = r.id;
  return typeof id === "string" || typeof id === "number" ? String(id) : `row-${i}`;
}

/* ── Stack ──────────────────────────────────────────────────── */
function renderStack(node: StackNode, ctx: DataContext, row?: Record<string, unknown>) {
  const dir = node.direction === "row" ? "row" : "column";
  const gap = gapPx[node.gap ?? "md"];
  return (
    <div
      key={node.id}
      style={{ display: "flex", flexDirection: dir, gap }}
      data-fluid-node="stack"
      data-fluid-id={node.id}
    >
      {node.children.map((c, i) => <div key={c.id ?? i}>{renderNode(c, ctx, row)}</div>)}
    </div>
  );
}

/* ── Split ──────────────────────────────────────────────────── */
function renderSplit(node: SplitNode, ctx: DataContext, row?: Record<string, unknown>) {
  const cols = ratioMap[node.ratio ?? "1:1"];
  return (
    <div
      key={node.id}
      style={{ display: "grid", gridTemplateColumns: cols, gap: "16px" }}
      data-fluid-node="split"
      data-fluid-id={node.id}
    >
      <div style={{ minWidth: 0 }}>{renderNode(node.left, ctx, row)}</div>
      <div style={{ minWidth: 0 }}>{renderNode(node.right, ctx, row)}</div>
    </div>
  );
}

/* ── Grid ───────────────────────────────────────────────────── */
function renderGrid(node: GridNode, ctx: DataContext, row?: Record<string, unknown>) {
  const cols = node.cols ?? 3;
  return (
    <div
      key={node.id}
      style={{ display: "grid", gridTemplateColumns: `repeat(${cols}, minmax(0,1fr))`, gap: "16px" }}
      data-fluid-node="grid"
      data-fluid-id={node.id}
    >
      {node.children.map((c, i) => <div key={c.id ?? i}>{renderNode(c, ctx, row)}</div>)}
    </div>
  );
}

/* ── Heading ────────────────────────────────────────────────── */
function renderHeading(node: HeadingNode) {
  const level = node.level ?? 2;
  const style: React.CSSProperties =
    level === 1
      ? { fontSize: "22px", fontWeight: 700, letterSpacing: "-0.03em", color: T.text1, marginBottom: "16px", background: `linear-gradient(135deg, ${T.text1}, #a5b4fc)`, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }
      : level === 2
      ? { fontSize: "16px", fontWeight: 600, color: T.text1, marginBottom: "12px" }
      : { fontSize: "11px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.1em", color: T.text3, marginBottom: "8px" };
  return (
    <div key={node.id} style={style} data-fluid-node="heading" data-fluid-id={node.id}>
      {node.text}
    </div>
  );
}

/* ── Field ──────────────────────────────────────────────────── */
function renderField(node: FieldNode, row?: Record<string, unknown>) {
  const value = resolveBinding(node.binding, row);
  return (
    <div
      key={node.id}
      style={{ display: "flex", alignItems: "baseline", gap: "6px", fontSize: "12px" }}
      data-fluid-node="field"
      data-fluid-id={node.id}
      data-fluid-entity={node.binding.entity}
    >
      {node.label && (
        <span style={{ color: T.text3, fontSize: "11px", flexShrink: 0 }}>{node.label}:</span>
      )}
      <span style={{ color: T.text2 }}>{value}</span>
    </div>
  );
}

/* ── Badge ──────────────────────────────────────────────────── */
function renderBadge(node: BadgeNode, row?: Record<string, unknown>) {
  const value = resolveBinding(node.binding, row);
  const tone = node.tone ?? (node.binding.format === "priority" ? priorityTone(value) : "neutral");
  return (
    <span
      key={node.id}
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: "2px 8px",
        borderRadius: "20px",
        fontSize: "11px",
        fontWeight: 500,
        background: toneBg[tone] ?? toneBg.neutral,
        color: toneColor[tone] ?? toneColor.neutral,
        border: `1px solid ${toneRing[tone] ?? toneRing.neutral}`,
      }}
      data-fluid-node="badge"
      data-fluid-id={node.id}
      data-fluid-entity={node.binding.entity}
    >
      {value}
    </span>
  );
}

/* ── Action button ──────────────────────────────────────────── */
function renderAction(node: ActionNode, row?: Record<string, unknown>) {
  const resolvedArgs: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(node.args)) {
    if (typeof val === "object" && val !== null && "kind" in val) {
      resolvedArgs[key] = resolveBinding(val, row);
    } else {
      resolvedArgs[key] = val;
    }
  }
  const style = node.style ?? "secondary";
  const btnStyle: React.CSSProperties =
    style === "primary"
      ? { background: `linear-gradient(135deg, ${T.accent}, ${T.accent2})`, color: "white", border: `1px solid rgba(99,102,241,0.3)`, fontWeight: 600 }
      : style === "danger"
      ? { background: "linear-gradient(135deg, #e11d48, #f43f5e)", color: "white", border: "1px solid rgba(244,63,94,0.3)", fontWeight: 600 }
      : { background: T.bg, color: T.text2, border: `1px solid ${T.border}` };

  return (
    <button
      key={node.id}
      type="button"
      style={{
        padding: "5px 12px",
        fontSize: "11px",
        borderRadius: T.radiusSm,
        cursor: "pointer",
        fontFamily: "inherit",
        transition: "all 0.18s",
        ...btnStyle,
      }}
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

/* ── Card ───────────────────────────────────────────────────── */
function renderCard(node: CardNode, row?: Record<string, unknown>) {
  return (
    <div
      key={node.id}
      style={{
        background: T.bg,
        border: `1px solid ${T.border}`,
        borderRadius: T.radius,
        padding: "14px",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
        transition: "border-color 0.18s, transform 0.18s, box-shadow 0.18s",
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLDivElement).style.borderColor = T.borderHover;
        (e.currentTarget as HTMLDivElement).style.transform = "translateY(-1px)";
        (e.currentTarget as HTMLDivElement).style.boxShadow = `0 4px 20px rgba(99,102,241,0.1)`;
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLDivElement).style.borderColor = T.border;
        (e.currentTarget as HTMLDivElement).style.transform = "translateY(0)";
        (e.currentTarget as HTMLDivElement).style.boxShadow = "none";
      }}
      data-fluid-node="card"
      data-fluid-id={node.id}
      data-fluid-entity={
        typeof node.title === "object" && node.title !== null && "entity" in node.title
          ? node.title.entity
          : undefined
      }
    >
      {node.title && (
        <div style={{ fontSize: "13px", fontWeight: 600, color: T.text1, marginBottom: "4px" }}>
          {resolveBinding(node.title, row)}
        </div>
      )}
      {node.subtitle && (
        <div style={{ fontSize: "11px", color: T.text3, marginBottom: "10px", lineHeight: 1.5 }}>
          {resolveBinding(node.subtitle, row)}
        </div>
      )}
      {node.badges && node.badges.length > 0 && (
        <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", marginBottom: "10px" }}>
          {node.badges.map((b, i) => <span key={i}>{renderBadge(b, row)}</span>)}
        </div>
      )}
      {node.fields && node.fields.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
          {node.fields.map((f, i) => <span key={i}>{renderField(f, row)}</span>)}
        </div>
      )}
      {node.actions && node.actions.length > 0 && (
        <div style={{ display: "flex", gap: "8px", marginTop: "12px", paddingTop: "12px", borderTop: `1px solid ${T.border}` }}>
          {node.actions.map((a, i) => <span key={i}>{renderAction(a, row)}</span>)}
        </div>
      )}
    </div>
  );
}

/* ── Stat ───────────────────────────────────────────────────── */
function renderStat(node: StatNode, ctx: DataContext) {
  const rows = (ctx[node.query.entity] ?? []) as Record<string, unknown>[];
  const filtered = runQuery(rows, node.query);
  let value: number | string = 0;
  if (node.aggregate === "count") value = filtered.length;
  else if (node.aggregate === "countWhere")
    value = filtered.filter((r) => r[node.whereField ?? ""] === node.whereValue).length;
  else if (node.aggregate === "sum")
    value = filtered.reduce((acc, r) => acc + Number(r[node.field ?? ""] ?? 0), 0);

  return (
    <div
      key={node.id}
      style={{
        background: T.bg,
        border: `1px solid ${T.border}`,
        borderRadius: T.radius,
        padding: "16px 16px 16px 20px",
        borderLeft: `3px solid ${T.accent}`,
        backdropFilter: "blur(12px)",
      }}
      data-fluid-node="stat"
      data-fluid-id={node.id}
      data-fluid-entity={node.query.entity}
    >
      <div style={{ fontSize: "10px", textTransform: "uppercase", letterSpacing: "0.1em", fontWeight: 600, color: T.text3 }}>
        {node.label}
      </div>
      <div style={{ fontSize: "30px", fontWeight: 700, color: T.text1, marginTop: "6px", letterSpacing: "-0.03em", fontVariantNumeric: "tabular-nums" }}>
        {value}
      </div>
    </div>
  );
}

/* ── List ───────────────────────────────────────────────────── */
function renderList(node: ListNode, ctx: DataContext) {
  const rows = (ctx[node.query.entity] ?? []) as Record<string, unknown>[];
  const data = runQuery(rows, node.query);
  const gap = node.variant === "compact" ? "6px" : "10px";

  if (data.length === 0) {
    return (
      <div style={{ fontSize: "13px", color: T.text3, textAlign: "center", padding: "32px 0", fontStyle: "italic" }}>
        {node.emptyText ?? "Nothing here."}
      </div>
    );
  }
  if (node.query.groupBy && node.groupHeader) {
    const groups = groupRows(data, node.query.groupBy);
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "20px" }} data-fluid-node="list" data-fluid-id={node.id} data-fluid-entity={node.query.entity}>
        {Object.entries(groups).map(([key, items]) => (
          <div key={key}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "10px" }}>
              <div style={{ height: "3px", width: "16px", borderRadius: "2px", background: `linear-gradient(90deg, ${T.accent}, ${T.accent3})` }} />
              <span style={{ fontSize: "10px", textTransform: "uppercase", letterSpacing: "0.1em", fontWeight: 600, color: T.text3 }}>{key}</span>
              <span style={{ fontSize: "10px", color: T.text3, opacity: 0.6 }}>({items.length})</span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap }}>
              {items.map((r, i) => <div key={rowKey(r, i)}>{renderNode(node.item, ctx, r)}</div>)}
            </div>
          </div>
        ))}
      </div>
    );
  }
  return (
    <div style={{ display: "flex", flexDirection: "column", gap }} data-fluid-node="list" data-fluid-id={node.id} data-fluid-entity={node.query.entity}>
      {data.map((r, i) => <div key={rowKey(r, i)}>{renderNode(node.item, ctx, r)}</div>)}
    </div>
  );
}

/* ── Kanban ─────────────────────────────────────────────────── */
function renderKanban(node: KanbanNode, ctx: DataContext) {
  const rows = (ctx[node.query.entity] ?? []) as Record<string, unknown>[];
  const data = runQuery(rows, node.query);
  const groups = groupRows(data, node.groupBy);

  return (
    <div
      key={node.id}
      style={{
        display: "grid",
        gridTemplateColumns: `repeat(${node.columns.length}, minmax(220px, 1fr))`,
        gap: "12px",
        overflowX: "auto",
        paddingBottom: "8px",
      }}
      data-fluid-node="kanban"
      data-fluid-id={node.id}
      data-fluid-entity={node.query.entity}
    >
      {node.columns.map((col) => {
        const colItems = groups[col] ?? [];
        return (
          <div
            key={col}
            style={{
              background: T.bg,
              border: `1px solid ${T.border}`,
              borderRadius: T.radiusLg,
              padding: "14px",
              minHeight: "300px",
              backdropFilter: "blur(12px)",
              WebkitBackdropFilter: "blur(12px)",
            }}
          >
            {/* Column header */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px", paddingBottom: "10px", borderBottom: `1px solid ${T.border}` }}>
              <div style={{ display: "flex", alignItems: "center", gap: "7px" }}>
                <div style={{ height: "6px", width: "6px", borderRadius: "50%", background: `linear-gradient(135deg, ${T.accent}, ${T.accent2})`, boxShadow: `0 0 6px rgba(99,102,241,0.5)` }} />
                <span style={{ fontSize: "11px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.1em", color: T.text2 }}>
                  {col.replace(/_/g, " ")}
                </span>
              </div>
              <span style={{ fontSize: "10px", fontWeight: 600, padding: "2px 7px", borderRadius: "20px", background: "rgba(255,255,255,0.06)", color: T.text3, fontVariantNumeric: "tabular-nums" }}>
                {colItems.length}
              </span>
            </div>
            {/* Cards */}
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {colItems.map((r, i) => (
                <div key={rowKey(r, i)}>{renderCard(node.card, r)}</div>
              ))}
              {colItems.length === 0 && (
                <div style={{ fontSize: "11px", color: T.text3, textAlign: "center", padding: "24px 0", fontStyle: "italic", opacity: 0.5 }}>
                  Empty
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
