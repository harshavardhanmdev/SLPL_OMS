import "server-only";

import { db } from "@/lib/db";
import { copiesFor, setComposition, type RegisterRow } from "@/lib/stock-register";
import { monthWindow, type MonthWindow } from "@/lib/stock-moves";

export { monthWindow, kindLabel, signFor, MOVE_KINDS } from "@/lib/stock-moves";
export type { MoveKind, MonthWindow } from "@/lib/stock-moves";

/**
 * The monthly stock position, built from the snapshot plus everything that has
 * moved since.
 *
 * The StockCount rows are the register as counted on one day. Every receipt,
 * issue, return and correction after that is a StockMovement. So any month is
 * opening plus movements equals closing, and the closing rolls into the next
 * month without anyone retyping it. That is the whole point: the banker's
 * statement stops being a monthly piece of handwork.
 */

export type LedgerLine = {
  label: string;
  series: string | null;
  unit: "SET" | "COPY";
  titlesPerSet: number;
  opening: number;
  received: number;
  issued: number;
  returnedIn: number;
  returnedOut: number;
  adjusted: number;
  closing: number;
  /**
   * Telugu and Hindi are held outside the Grade 1 to 5 sets, because a school
   * can take the core set without a language book. They are 13,906 books on
   * the shelf, so leaving them out of a bank statement understates it badly.
   */
  openingTelugu: number;
  openingHindi: number;
  movedTelugu: number;
  movedHindi: number;
  closingTelugu: number;
  closingHindi: number;
  /** Books rather than sets, which is what an auditor counts on a shelf. */
  closingCopies: number;
};

export type MonthlyStatement = {
  window: MonthWindow;
  countedOn: Date | null;
  lines: LedgerLine[];
  totals: {
    opening: number;
    received: number;
    issued: number;
    returnedIn: number;
    returnedOut: number;
    adjusted: number;
    closing: number;
    closingTelugu: number;
    closingHindi: number;
    closingCopies: number;
  };
};

/**
 * Every line that has either a counted opening position or a movement, so a
 * title first received after the count still appears.
 */
export async function monthlyStatement(key?: string | null): Promise<MonthlyStatement> {
  const window = monthWindow(key);

  const latest = await db.stockCount.findFirst({
    orderBy: { asOf: "desc" },
    select: { asOf: true },
  });
  const countedOn = latest?.asOf ?? null;

  const [counts, movements] = await Promise.all([
    countedOn
      ? (db.stockCount.findMany({
          where: { asOf: countedOn },
          orderBy: { sortOrder: "asc" },
        }) as unknown as Promise<RegisterRow[]>)
      : Promise.resolve([] as RegisterRow[]),
    db.stockMovement.findMany({
      where: { voidedAt: null, movedAt: { lt: window.end } },
      orderBy: { movedAt: "asc" },
    }),
  ]);

  const order: string[] = [];
  const lines = new Map<string, LedgerLine>();

  const ensure = (label: string, series: string | null, unit: "SET" | "COPY") => {
    let line = lines.get(label);
    if (!line) {
      line = {
        label,
        series,
        unit,
        titlesPerSet: unit === "SET" ? setComposition(label).length : 1,
        opening: 0,
        received: 0,
        issued: 0,
        returnedIn: 0,
        returnedOut: 0,
        adjusted: 0,
        closing: 0,
        openingTelugu: 0,
        openingHindi: 0,
        movedTelugu: 0,
        movedHindi: 0,
        closingTelugu: 0,
        closingHindi: 0,
        closingCopies: 0,
      };
      lines.set(label, line);
      order.push(label);
    }
    return line;
  };

  // The counted balance is the starting point for everything after it
  for (const row of counts) {
    const line = ensure(row.label, row.series ?? null, row.unit);
    line.opening = row.inventory;
    line.openingTelugu = row.inventoryTelugu ?? 0;
    line.openingHindi = row.inventoryHindi ?? 0;
  }

  for (const m of movements) {
    const line = ensure(m.label, m.series ?? null, m.unit);
    // Anything on or before the count date is already inside the counted balance
    if (countedOn && m.movedAt <= countedOn) continue;
    // Between the count and this month, it has already moved the opening figure
    if (m.movedAt < window.start) {
      line.opening += m.quantity;
      line.openingTelugu += m.quantityTelugu ?? 0;
      line.openingHindi += m.quantityHindi ?? 0;
      continue;
    }
    if (m.kind === "INWARD") line.received += m.quantity;
    else if (m.kind === "OUTWARD") line.issued += Math.abs(m.quantity);
    else if (m.kind === "RETURN_IN") line.returnedIn += m.quantity;
    else if (m.kind === "RETURN_OUT") line.returnedOut += Math.abs(m.quantity);
    else line.adjusted += m.quantity;
    line.movedTelugu += m.quantityTelugu ?? 0;
    line.movedHindi += m.quantityHindi ?? 0;
  }

  const totals = {
    opening: 0,
    received: 0,
    issued: 0,
    returnedIn: 0,
    returnedOut: 0,
    adjusted: 0,
    closing: 0,
    closingTelugu: 0,
    closingHindi: 0,
    closingCopies: 0,
  };

  const out: LedgerLine[] = [];
  for (const label of order) {
    const line = lines.get(label)!;
    line.closing =
      line.opening + line.received + line.returnedIn - line.issued - line.returnedOut + line.adjusted;
    line.closingTelugu = line.openingTelugu + line.movedTelugu;
    line.closingHindi = line.openingHindi + line.movedHindi;
    // A set expands to its titles; the language books are already single copies
    line.closingCopies =
      (line.unit === "COPY" ? line.closing : line.closing * Math.max(1, line.titlesPerSet)) +
      line.closingTelugu +
      line.closingHindi;
    out.push(line);
    for (const k of Object.keys(totals) as (keyof typeof totals)[]) totals[k] += line[k];
  }

  return { window, countedOn, lines: out, totals };
}

/** Totals in books for the counted snapshot alone, used on the browse screen. */
export function countedCopies(rows: RegisterRow[]) {
  return rows.reduce(
    (acc, r) => {
      const c = copiesFor(r);
      return {
        inward: acc.inward + c.inward,
        outward: acc.outward + c.outward,
        inventory: acc.inventory + c.inventory,
      };
    },
    { inward: 0, outward: 0, inventory: 0 },
  );
}
