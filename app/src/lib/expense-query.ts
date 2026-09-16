import { EXPENSE_CATEGORIES, PAID_FROM, financialYearOf } from "@/lib/expense-constants";

/**
 * Turns the URL query into a date window, a Prisma filter and a human label.
 *
 * Everything the search does lives in the URL, so a filtered view can be
 * bookmarked, sent to the accountant, or handed to the statement page and
 * printed exactly as it was found.
 */

export type ExpenseQuery = {
  q?: string;
  from?: string;
  to?: string;
  cat?: string; // comma separated
  mode?: string; // comma separated
  dow?: string; // 0 Sunday to 6 Saturday, comma separated
  period?: string;
};

export const PERIODS = [
  { value: "today", label: "Today" },
  { value: "yesterday", label: "Yesterday" },
  { value: "7d", label: "Last 7 days" },
  { value: "month", label: "This month" },
  { value: "lastmonth", label: "Last month" },
  { value: "fy", label: "This financial year" },
  { value: "lastfy", label: "Last financial year" },
  { value: "all", label: "Everything" },
] as const;

export const DAYS = [
  { value: "1", label: "Mon" },
  { value: "2", label: "Tue" },
  { value: "3", label: "Wed" },
  { value: "4", label: "Thu" },
  { value: "5", label: "Fri" },
  { value: "6", label: "Sat" },
  { value: "0", label: "Sun" },
] as const;

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const endOfDay = (d: Date) =>
  new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);

/** The date window, honouring an explicit from/to over the named period. */
export function resolveWindow(query: ExpenseQuery, now = new Date()) {
  if (query.from || query.to) {
    const from = query.from ? startOfDay(new Date(query.from)) : new Date(2000, 0, 1);
    const to = query.to ? endOfDay(new Date(query.to)) : endOfDay(now);
    return { from, to, label: "Custom range" };
  }

  const fy = financialYearOf(now);
  switch (query.period) {
    case "today":
      return { from: startOfDay(now), to: endOfDay(now), label: "Today" };
    case "yesterday": {
      const y = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
      return { from: startOfDay(y), to: endOfDay(y), label: "Yesterday" };
    }
    case "7d":
      return {
        from: startOfDay(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6)),
        to: endOfDay(now),
        label: "Last 7 days",
      };
    case "month":
      return {
        from: new Date(now.getFullYear(), now.getMonth(), 1),
        to: endOfDay(now),
        label: "This month",
      };
    case "lastmonth":
      return {
        from: new Date(now.getFullYear(), now.getMonth() - 1, 1),
        to: endOfDay(new Date(now.getFullYear(), now.getMonth(), 0)),
        label: "Last month",
      };
    case "lastfy": {
      const prev = financialYearOf(new Date(fy.start.getFullYear() - 1, 5, 1));
      return { from: prev.start, to: prev.end, label: `FY ${prev.label}` };
    }
    case "all":
      return { from: new Date(2000, 0, 1), to: endOfDay(now), label: "Everything" };
    default:
      return { from: fy.start, to: fy.end, label: `FY ${fy.label}` };
  }
}

const csv = (value?: string) =>
  (value ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

export function parseFilters(query: ExpenseQuery) {
  const valid = new Set(EXPENSE_CATEGORIES.map((c) => c.value as string));
  const validModes = new Set(PAID_FROM.map((p) => p.value as string));
  return {
    text: (query.q ?? "").trim(),
    categories: csv(query.cat).filter((c) => valid.has(c)),
    modes: csv(query.mode).filter((m) => validModes.has(m)),
    days: csv(query.dow).filter((d) => /^[0-6]$/.test(d)),
  };
}

/** The Prisma where clause. Day of week is applied afterwards, in JavaScript. */
export function buildWhere(query: ExpenseQuery, now = new Date()) {
  const window = resolveWindow(query, now);
  const f = parseFilters(query);
  return {
    where: {
      spentAt: { gte: window.from, lte: window.to },
      ...(f.categories.length > 0 ? { category: { in: f.categories as never } } : {}),
      ...(f.modes.length > 0 ? { paidFrom: { in: f.modes as never } } : {}),
      ...(f.text
        ? {
            OR: [
              { payee: { contains: f.text, mode: "insensitive" as const } },
              { note: { contains: f.text, mode: "insensitive" as const } },
              { voucherNo: { contains: f.text, mode: "insensitive" as const } },
              { reference: { contains: f.text, mode: "insensitive" as const } },
            ],
          }
        : {}),
    },
    window,
    filters: f,
  };
}

/** Postgres has no portable day-of-week filter through Prisma, so filter here. */
export function applyDayOfWeek<T extends { spentAt: Date }>(rows: T[], days: string[]): T[] {
  if (days.length === 0) return rows;
  const want = new Set(days.map(Number));
  return rows.filter((r) => want.has(r.spentAt.getDay()));
}

/** Rebuilds the query string, dropping empties so URLs stay readable. */
export function toSearchParams(query: ExpenseQuery): string {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(query)) if (v) p.set(k, v);
  const s = p.toString();
  return s ? `?${s}` : "";
}
