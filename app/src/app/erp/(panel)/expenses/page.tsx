export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { FileText, Receipt, Wallet } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ExpenseFilters } from "@/components/erp/expense-filters";
import { ExpenseForm } from "@/components/erp/expense-form";
import { ExpenseRowActions } from "@/components/erp/expense-row-actions";
import { db } from "@/lib/db";
import { categoryLabel, paidFromLabel } from "@/lib/expense-constants";
import {
  applyDayOfWeek,
  buildWhere,
  toSearchParams,
  type ExpenseQuery,
} from "@/lib/expense-query";
import { formatINR } from "@/lib/money";

export const metadata: Metadata = { title: "Expenses", robots: { index: false } };

const dateIN = (d: Date) =>
  d.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short", year: "numeric" });

export default async function ExpensesPage({
  searchParams,
}: {
  searchParams: Promise<ExpenseQuery>;
}) {
  const query = await searchParams;
  const { where, window, filters } = buildWhere(query);

  const rows = await db.expense.findMany({
    where,
    orderBy: [{ spentAt: "desc" }, { createdAt: "desc" }],
    take: 1000,
  });
  const expenses = applyDayOfWeek(rows, filters.days);

  // Totals follow the search, so the numbers always describe what is on screen
  const total = expenses.reduce((s, e) => s + e.amount, 0);
  const gstTotal = expenses.reduce((s, e) => s + (e.gstAmount ?? 0), 0);

  const byCategory = [...expenses
    .reduce((m, e) => m.set(e.category, (m.get(e.category) ?? 0) + e.amount), new Map<string, number>())
    .entries()]
    .sort((a, b) => b[1] - a[1]);
  const byMode = [...expenses
    .reduce((m, e) => m.set(e.paidFrom, (m.get(e.paidFrom) ?? 0) + e.amount), new Map<string, number>())
    .entries()]
    .sort((a, b) => b[1] - a[1]);

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <div>
        <h1 className="font-heading text-2xl font-bold">Expenses</h1>
        <p className="text-sm text-muted-foreground">
          Every rupee out of the current account. Showing {window.label.toLowerCase()}.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <ExpenseForm />
        <Button variant="outline" className="gap-2" asChild>
          <Link href={`/erp/expenses/report${toSearchParams(query)}`}>
            <FileText className="size-4" /> Statement for the auditor
          </Link>
        </Button>
      </div>

      <ExpenseFilters resultCount={expenses.length} />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-2xl border bg-card p-4">
          <p className="text-xs text-muted-foreground">Total shown</p>
          <p className="font-heading text-xl font-bold">{formatINR(total)}</p>
          <p className="text-xs text-muted-foreground">{expenses.length} entries</p>
        </div>
        <div className="rounded-2xl border bg-card p-4">
          <p className="text-xs text-muted-foreground">GST in bills</p>
          <p className="font-heading text-xl font-bold">{formatINR(gstTotal)}</p>
          <p className="text-xs text-muted-foreground">possible input credit</p>
        </div>
        <div className="rounded-2xl border bg-card p-4">
          <p className="text-xs text-muted-foreground">Biggest head</p>
          <p className="font-heading text-base font-bold">
            {byCategory[0] ? categoryLabel(byCategory[0][0]) : "-"}
          </p>
          <p className="text-xs text-muted-foreground">
            {byCategory[0] ? formatINR(byCategory[0][1]) : ""}
          </p>
        </div>
        <div className="rounded-2xl border bg-card p-4">
          <p className="text-xs text-muted-foreground">Mostly paid by</p>
          <p className="font-heading text-base font-bold">
            {byMode[0] ? paidFromLabel(byMode[0][0]) : "-"}
          </p>
          <p className="text-xs text-muted-foreground">
            {byMode[0] ? formatINR(byMode[0][1]) : ""}
          </p>
        </div>
      </div>

      {byCategory.length > 0 && (
        <section className="rounded-2xl border bg-card p-4">
          <h2 className="mb-3 font-heading font-semibold">Where it went</h2>
          <ul className="space-y-2">
            {byCategory.map(([category, amount]) => {
              const share = total > 0 ? Math.round((amount / total) * 100) : 0;
              return (
                <li key={category} className="text-sm">
                  <div className="mb-1 flex justify-between gap-3">
                    <span>{categoryLabel(category)}</span>
                    <span className="font-medium">
                      {formatINR(amount)} <span className="text-muted-foreground">{share}%</span>
                    </span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                    <div className="h-full rounded-full bg-saffron" style={{ width: `${share}%` }} />
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <section className="rounded-2xl border bg-card">
        <h2 className="border-b p-4 font-heading font-semibold">The log</h2>
        {expenses.length === 0 ? (
          <div className="p-10 text-center">
            <Wallet className="mx-auto size-8 text-muted-foreground" />
            <p className="mt-3 font-medium">Nothing matches.</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Widen the dates or clear the filters, or log the first expense for this period.
            </p>
          </div>
        ) : (
          <ul className="divide-y">
            {expenses.map((e) => {
              const voided = e.amount === 0;
              return (
                <li key={e.id} className="flex flex-wrap items-start justify-between gap-3 p-4">
                  <div className="flex min-w-0 items-start gap-3">
                    {e.billImage ? (
                      <Link href={e.billImage} target="_blank" className="shrink-0">
                        <Image
                          src={e.billImage}
                          alt="Bill"
                          width={40}
                          height={52}
                          className="h-13 w-10 rounded-md border object-cover"
                        />
                      </Link>
                    ) : (
                      <span className="flex h-13 w-10 shrink-0 items-center justify-center rounded-md border bg-muted">
                        <Receipt className="size-4 text-muted-foreground/50" />
                      </span>
                    )}
                    <div className="min-w-0">
                      <p className={`font-medium ${voided ? "line-through opacity-60" : ""}`}>
                        {categoryLabel(e.category)}
                        {e.payee ? ` · ${e.payee}` : ""}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {dateIN(e.spentAt)} · {paidFromLabel(e.paidFrom)} · {e.voucherNo}
                        {e.reference ? ` · ${e.reference}` : ""}
                      </p>
                      {e.note && <p className="mt-0.5 text-xs text-muted-foreground">{e.note}</p>}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      {voided ? (
                        <Badge variant="outline">voided</Badge>
                      ) : (
                        <>
                          <p className="font-heading font-bold">{formatINR(e.amount)}</p>
                          {e.gstAmount != null && e.gstAmount > 0 && (
                            <p className="text-xs text-muted-foreground">
                              incl GST {formatINR(e.gstAmount)}
                            </p>
                          )}
                        </>
                      )}
                    </div>
                    {!voided && <ExpenseRowActions id={e.id} />}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
