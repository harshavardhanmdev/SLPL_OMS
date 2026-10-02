/**
 * The vocabulary of a stock movement.
 *
 * Kept apart from stock-ledger.ts, which talks to the database and is server
 * only, so the recording form can share one definition of the kinds rather
 * than keeping its own list that drifts.
 */

export type MoveKind = "INWARD" | "OUTWARD" | "RETURN_IN" | "RETURN_OUT" | "ADJUSTMENT";

export const MOVE_KINDS: { value: MoveKind; label: string; adds: boolean }[] = [
  { value: "INWARD", label: "Received from the printer", adds: true },
  { value: "OUTWARD", label: "Issued to a school or customer", adds: false },
  { value: "RETURN_IN", label: "Returned to us by a school", adds: true },
  { value: "RETURN_OUT", label: "Sent back to the printer", adds: false },
  { value: "ADJUSTMENT", label: "Correction after a physical count", adds: true },
];

export function kindLabel(kind: string): string {
  return MOVE_KINDS.find((k) => k.value === kind)?.label ?? kind;
}

/** Positive adds to the shelf, negative takes away. ADJUSTMENT carries its own sign. */
export function signFor(kind: MoveKind): 1 | -1 {
  return kind === "OUTWARD" || kind === "RETURN_OUT" ? -1 : 1;
}

export type MonthWindow = { start: Date; end: Date; label: string; key: string };

/** The month a `YYYY-MM` string names, in local time, end exclusive. */
export function monthWindow(key?: string | null): MonthWindow {
  const now = new Date();
  const m = /^(\d{4})-(\d{2})$/.exec(key ?? "");
  const year = m ? Number(m[1]) : now.getFullYear();
  const month = m ? Number(m[2]) - 1 : now.getMonth();
  const start = new Date(year, month, 1);
  const end = new Date(year, month + 1, 1);
  return {
    start,
    end,
    label: start.toLocaleDateString("en-IN", { month: "long", year: "numeric" }),
    key: `${year}-${String(month + 1).padStart(2, "0")}`,
  };
}
