import type { Binding, Query } from "@fluid-genui/core";

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
          return compare(v, value) >= 0;
        case "lte":
          return compare(v, value) <= 0;
      }
    });
  }
  if (query.sortBy) {
    const sortBy = query.sortBy;
    out.sort((a, b) => compare(a[sortBy], b[sortBy]));
  }
  if (query.limit) out = out.slice(0, query.limit);
  return out;
}

function compare(a: unknown, b: unknown): number {
  if (a === b) return 0;
  if (a == null) return b == null ? 0 : -1;
  if (b == null) return 1;
  if (typeof a === "number" && typeof b === "number") return a - b;
  if (typeof a === "boolean" && typeof b === "boolean") {
    return (a ? 1 : 0) - (b ? 1 : 0);
  }
  const as = String(a);
  const bs = String(b);
  if (isDateLike(as) && isDateLike(bs)) {
    return Date.parse(as) - Date.parse(bs);
  }
  return as < bs ? -1 : as > bs ? 1 : 0;
}

function isDateLike(s: string): boolean {
  return /^\d{4}-\d{2}-\d{2}/.test(s);
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
  if (Number.isNaN(d.getTime())) return iso;
  const days = Math.round((d.getTime() - now.getTime()) / 86_400_000);
  if (days === 0) return "today";
  if (days === 1) return "tomorrow";
  if (days === -1) return "yesterday";
  if (days > 0) return `in ${days}d`;
  return `${-days}d ago`;
}
