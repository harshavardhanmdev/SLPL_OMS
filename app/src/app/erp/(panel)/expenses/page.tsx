export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { FileText, Receipt, Wallet } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ExpenseForm } from "@/components/erp/expense-form";
import { ExpenseRowActions } from "@/components/erp/expense-row-actions";
import { db } from "@/lib/db";
import { categoryLabel, financialYearOf, paidFromLabel } from "@/lib/expense-constants";
import { formatINR } from "@/lib/money";

export const metadata: Metadata = { title: "Expenses", robots: { index: false } };

const dateIN = (d: Date) =>
  d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });

export default async function ExpensesPage({
  searchParams,
}: {
  searchParams: Promise<{ fy?: string }>;
}) {
  const { fy } = await searchParams;
  const now = new Date();
  const current = financialYearOf(now);
  // A previous year is requested as its start year, e.g. ?fy=2025
  const year = fy ? financialYearOf(new Date(Number(fy), 5, 1)) : current;

  const [expenses, byCategory, thisMonth] = await Promise.all([
    db.expense.findMany({
      where: { spentAt: { gte: year.start, lte: year.end } },
      orderBy: [{ spentAt: "desc" }, { createdAt: "desc" }],
      take: 400,
    }),
    db.expense.groupBy({
      by: ["category"],
      where: { spentAt: { gte: year.start, lte: year.end } },
      _sum: { amount: true },
      orderBy: { _sum: { amount: "desc" } },
    }),
    db.expense.aggregate({
      where: { spentAt: { gte: new Date(now.getFullYear(), now.getMonth(), 1) } },
      _sum: { amount: true },
      _count: true,
    }),
  ]);

  const yearTotal = byCategory.reduce((s, c) => s + (c._sum.amount ?? 0), 0);
  const gstTotal = expenses.reduce((s, e) => s + (e.gstAmount ?? 0), 0);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-bold">Expenses</h1>
        <p className="text-sm text-muted-foreground">
          Every rupee out of the current account, financial year {year.label}.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-2xl border bg-card p-4">
          <p className="text-xs text-muted-foreground">This month</p>
          <p className="font-heading text-xl font-bold">{formatINR(thisMonth._sum.amount ?? 0)}</p>
          <p className="text-xs text-muted-foreground">{thisMonth._count} entries</p>
        </div>
        <div className="rounded-2xl border bg-card p-4">
          <p className="text-xs text-muted-foreground">FY {year.label}</p>
          <p className="font-heading text-xl font-bold">{formatINR(yearTotal)}</p>
          <p className="text-xs text-muted-foreground">{expenses.length} entries</p>
        </div>
        <div className="rounded-2xl border bg-card p-4">
          <p className="text-xs text-muted-foreground">GST in bills</p>
          <p className="font-heading text-xl font-bold">{formatINR(gstTotal)}</p>
          <p className="text-xs text-muted-foreground">possible input credit</p>
        </div>
        <div className="rounded-2xl border bg-card p-4">
          <p className="text-xs text-muted-foreground">Biggest head</p>
          <p className="font-heading text-lg font-bold">
            {byCategory[0] ? categoryLabel(byCategory[0].category) : "-"}
          </p>
          <p className="text-xs text-muted-foreground">
            {byCategory[0] ? formatINR(byCategory[0]._sum.amount ?? 0) : ""}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <ExpenseForm />
        <Button variant="outline" className="gap-2" asChild>
          <Link href={`/erp/expenses/report?fy=${year.label.slice(0, 4)}`}>
            <FileText className="size-4" /> Statement for the auditor
          </Link>
        </Button>
      </div>

      {byCategory.length > 0 && (
        <section className="rounded-2xl border bg-card p-4">
          <h2 className="mb-3 font-heading font-semibold">Where it went</h2>
          <ul className="space-y-2">
            {byCategory.map((c) => {
              const amount = c._sum.amount ?? 0;
              const share = yearTotal > 0 ? Math.round((amount / yearTotal) * 100) : 0;
              return (
                <li key={c.category} className="text-sm">
                  <div className="mb-1 flex justify-between gap-3">
                    <span>{categoryLabel(c.category)}</span>
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
            <p className="mt-3 font-medium">Nothing logged for {year.label} yet.</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Log the first one and it appears here, ready for the auditor.
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
