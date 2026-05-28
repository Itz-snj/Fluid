import type { Binding, Query } from "@/fluid/core";

export type DataContext = Record<string, unknown[]>;

export function runQuery<T extends Record<string, unknown>>(
  rows: T[],
  query: Query,
): T[] {
  let out = rows.slice();
  if (query.filter) {
    const { field, op, value } = query.filter;
    out = out.filter((r) => {
      const v = r[field];
      switch (op) {
        case "eq":
          return v === value;
        case "neq":
          return v !== value;
        case "in":
          return Array.isArray(value) && value.includes(v as string);
        case "gte":
          return (v as number) >= (value as number);
        case "lte":
          return (v as number) <= (value as number);
      }
    });
  }
  if (query.sortBy) {
    const sortBy = query.sortBy;
    out.sort((a, b) => {
      const av = a[sortBy];
      const bv = b[sortBy];
      if (av === bv) return 0;
      return (av as number | string) > (bv as number | string) ? 1 : -1;
    });
  }
  if (query.limit) out = out.slice(0, query.limit);
  return out;
}

export function groupRows<T extends Record<string, unknown>>(
  rows: T[],
  field: string,
): Record<string, T[]> {
  const groups: Record<string, T[]> = {};
  for (const r of rows) {
    const key = String(r[field] ?? "—");
    (groups[key] ||= []).push(r);
  }
  return groups;
}

export function resolveBinding(
  value: Binding | string | undefined,
  row: Record<string, unknown> | undefined,
): string {
  if (value === undefined) return "";
  if (typeof value === "string") return value;
  if (!row) return "";
  const raw = value.field ? row[value.field] : row[value.entity];
  return formatValue(raw, value.format);
}

function formatValue(raw: unknown, format?: Binding["format"]): string {
  if (raw == null) return "";
  if (Array.isArray(raw)) return raw.join(", ");
  switch (format) {
    case "date":
      return String(raw);
    case "relative-date":
      return relativeDate(String(raw));
    case "priority":
      return String(raw).toUpperCase();
    case "badge":
    case "text":
    default:
      return String(raw);
  }
}

function relativeDate(iso: string): string {
  const now = new Date("2026-05-29");
  const d = new Date(iso);
  const days = Math.round((d.getTime() - now.getTime()) / 86_400_000);
  if (days === 0) return "today";
  if (days === 1) return "tomorrow";
  if (days === -1) return "yesterday";
  if (days > 0) return `in ${days}d`;
  return `${-days}d ago`;
}
