export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, FileSignature, Newspaper, Wallet } from "lucide-react";

import { DeviceSetup } from "@/components/erp/device-setup";
import { db } from "@/lib/db";
import { financialYearOf } from "@/lib/expense-constants";
import { hasPin, isRememberedDevice } from "@/lib/expense-pin";
import { formatINR } from "@/lib/money";
import { getStaff, roleCan } from "@/lib/staff-auth";
import { issueLabelFor } from "@/lib/subscription-plans";

export const metadata: Metadata = { title: "Back office", robots: { index: false } };

/**
 * The landing screen, which now has to work for sales as well as finance, so
 * every tile is fetched only when the person is allowed to see what is on it.
 */
export default async function ErpHome() {
  const staff = await getStaff();
  const canFinance = staff ? roleCan(staff.role, "finance.read") : false;
  const canQuote = staff ? roleCan(staff.role, "quotes.read") : false;
  const year = financialYearOf(new Date());
  const issue = issueLabelFor();

  const [spend, activeSubs, dueSubs, openQuotes, quoteValue, trusted, pinSet] = await Promise.all([
    canFinance
      ? db.expense.aggregate({
          where: { spentAt: { gte: year.start, lte: year.end } },
          _sum: { amount: true },
          _count: true,
        })
      : null,
    canFinance ? db.subscription.count({ where: { status: "ACTIVE" } }) : 0,
    canFinance
      ? db.subscription.count({
          where: { status: "ACTIVE", dispatches: { none: { issueLabel: issue } } },
        })
      : 0,
    canQuote ? db.quotation.count({ where: { status: { in: ["DRAFT", "SENT"] } } }) : 0,
    canQuote
      ? db.quotation.aggregate({ where: { status: "SENT" }, _sum: { total: true } })
      : null,
    isRememberedDevice(),
    hasPin(),
  ]);

  const tile =
    "flex items-center justify-between gap-4 rounded-2xl border bg-card p-5 transition hover:border-saffron";
  const icon =
    "flex size-12 items-center justify-center rounded-xl bg-accent text-saffron-deep";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-bold">Back office</h1>
        <p className="text-sm text-muted-foreground">
          {staff?.name}
          {staff && !staff.breakGlass ? `, ${staff.role.toLowerCase().replace("_", " ")}` : ""}.
          Financial year {year.label}.
        </p>
      </div>

      {canQuote && (
        <Link href="/erp/quotations" className={tile}>
          <span className="flex items-center gap-4">
            <span className={icon}>
              <FileSignature className="size-6" />
            </span>
            <span>
              <span className="block font-heading font-semibold">Quotations</span>
              <span className="block text-sm text-muted-foreground">
                {openQuotes === 0
                  ? "Nothing open. Raise one for a school."
                  : `${openQuotes} open, ${formatINR(quoteValue?._sum.total ?? 0)} sent and awaiting a decision`}
              </span>
            </span>
          </span>
          <ArrowRight className="size-5 shrink-0 text-muted-foreground" />
        </Link>
      )}

      {canFinance && spend && (
        <Link href="/erp/expenses" className={tile}>
          <span className="flex items-center gap-4">
            <span className={icon}>
              <Wallet className="size-6" />
            </span>
            <span>
              <span className="block font-heading font-semibold">Expenses</span>
              <span className="block text-sm text-muted-foreground">
                {spend._count} entries, {formatINR(spend._sum.amount ?? 0)} this year
              </span>
            </span>
          </span>
          <ArrowRight className="size-5 shrink-0 text-muted-foreground" />
        </Link>
      )}

      {canFinance && (
        <Link href="/erp/subscriptions" className={tile}>
          <span className="flex items-center gap-4">
            <span className={icon}>
              <Newspaper className="size-6" />
            </span>
            <span>
              <span className="block font-heading font-semibold">Subscriptions</span>
              <span className="block text-sm text-muted-foreground">
                {activeSubs} active
                {dueSubs > 0 ? `, ${dueSubs} owed the ${issue} issue` : `, all caught up on ${issue}`}
              </span>
            </span>
          </span>
          <ArrowRight className="size-5 shrink-0 text-muted-foreground" />
        </Link>
      )}

      {canFinance && <DeviceSetup trusted={trusted && pinSet} />}
    </div>
  );
}
