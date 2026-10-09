import "server-only";

import { db } from "@/lib/db";
import { BILLED_STATUSES } from "@/lib/ledger";
import { financialYearLabel } from "@/lib/number-series";

/**
 * Target against achieved.
 *
 * Achieved is read off approved invoices, never from anything typed, so the
 * banner cannot be talked up. The owner asked for it to flash; it draws
 * attention only when the month is behind pace, because something that blinks
 * all day stops being read.
 */

export type Pace = {
  label: string;
  periodStart: Date;
  periodEnd: Date;
  daysLeft: number;
  /** How far through the period we are, 0 to 1. */
  elapsed: number;
  target: number;
  achieved: number;
  percent: number;
  /** True when achievement is behind where the calendar says it should be. */
  behind: boolean;
};

export function monthWindow(now = new Date()) {
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  return { start, end, label: start.toLocaleDateString("en-IN", { month: "long", year: "numeric" }) };
}

export function financialYearWindow(now = new Date()) {
  const startYear = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
  return {
    start: new Date(startYear, 3, 1),
    end: new Date(startYear + 1, 3, 1),
    label: `FY ${financialYearLabel(now)}`,
  };
}

function pace(
  label: string,
  start: Date,
  end: Date,
  target: number,
  achieved: number,
  now: Date,
): Pace {
  const span = end.getTime() - start.getTime();
  const gone = Math.min(span, Math.max(0, now.getTime() - start.getTime()));
  const elapsed = span > 0 ? gone / span : 0;
  const percent = target > 0 ? achieved / target : 0;
  return {
    label,
    periodStart: start,
    periodEnd: end,
    daysLeft: Math.max(0, Math.ceil((end.getTime() - now.getTime()) / 86400000)),
    elapsed,
    target,
    achieved,
    percent,
    // A little slack, so being a day behind does not set the thing flashing
    behind: target > 0 && percent < elapsed - 0.1,
  };
}

async function billed(start: Date, end: Date, createdById?: string | null): Promise<number> {
  const result = await db.invoice.aggregate({
    where: {
      status: { in: [...BILLED_STATUSES] },
      invoiceDate: { gte: start, lt: end },
      ...(createdById ? { createdById } : {}),
    },
    _sum: { total: true },
  });
  return result._sum.total ?? 0;
}

async function targetFor(
  scope: "COMPANY" | "PERSON",
  period: "MONTH" | "YEAR",
  periodStart: Date,
  ownerId: string | null,
): Promise<number> {
  const row = await db.salesTarget.findFirst({
    where: { scope, period, periodStart, ownerId },
    select: { revenueTarget: true },
  });
  return Number(row?.revenueTarget ?? 0);
}

export type SalesBanner = {
  mine: { month: Pace; year: Pace } | null;
  company: { month: Pace; year: Pace };
  myVisitsThisMonth: number;
  myVisitTarget: number;
  overdueActions: number;
  todayActions: number;
};

export async function salesBanner(staffId: string | null, now = new Date()): Promise<SalesBanner> {
  const m = monthWindow(now);
  const y = financialYearWindow(now);
  const personal = staffId && staffId !== "break-glass" ? staffId : null;

  const [
    companyMonthTarget,
    companyYearTarget,
    companyMonth,
    companyYear,
    myMonthTarget,
    myYearTarget,
    myMonth,
    myYear,
    myVisits,
    myVisitTargetRow,
    overdueActions,
    todayActions,
  ] = await Promise.all([
    targetFor("COMPANY", "MONTH", m.start, null),
    targetFor("COMPANY", "YEAR", y.start, null),
    billed(m.start, m.end),
    billed(y.start, y.end),
    personal ? targetFor("PERSON", "MONTH", m.start, personal) : 0,
    personal ? targetFor("PERSON", "YEAR", y.start, personal) : 0,
    personal ? billed(m.start, m.end, personal) : 0,
    personal ? billed(y.start, y.end, personal) : 0,
    personal
      ? db.visit.count({ where: { byId: personal, visitedOn: { gte: m.start, lt: m.end } } })
      : 0,
    personal
      ? db.salesTarget.findFirst({
          where: { scope: "PERSON", period: "MONTH", periodStart: m.start, ownerId: personal },
          select: { visitTarget: true },
        })
      : null,
    db.visit.count({
      where: {
        nextActionOn: { lt: new Date(now.getFullYear(), now.getMonth(), now.getDate()) },
        converted: false,
        organization: { status: { not: "LOST" } },
        ...(personal ? { byId: personal } : {}),
      },
    }),
    db.visit.count({
      where: {
        nextActionOn: {
          gte: new Date(now.getFullYear(), now.getMonth(), now.getDate()),
          lt: new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1),
        },
        ...(personal ? { byId: personal } : {}),
      },
    }),
  ]);

  return {
    mine: personal
      ? {
          month: pace(m.label, m.start, m.end, myMonthTarget, myMonth, now),
          year: pace(y.label, y.start, y.end, myYearTarget, myYear, now),
        }
      : null,
    company: {
      month: pace(m.label, m.start, m.end, companyMonthTarget, companyMonth, now),
      year: pace(y.label, y.start, y.end, companyYearTarget, companyYear, now),
    },
    myVisitsThisMonth: myVisits,
    myVisitTarget: myVisitTargetRow?.visitTarget ?? 0,
    overdueActions,
    todayActions,
  };
}
