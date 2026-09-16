export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Wallet } from "lucide-react";

import { DeviceSetup } from "@/components/erp/device-setup";
import { db } from "@/lib/db";
import { financialYearOf } from "@/lib/expense-constants";
import { hasPin, isRememberedDevice } from "@/lib/expense-pin";
import { formatINR } from "@/lib/money";

export const metadata: Metadata = { title: "Back office", robots: { index: false } };

export default async function ErpHome() {
  const year = financialYearOf(new Date());
  const [spend, trusted, pinSet] = await Promise.all([
    db.expense.aggregate({
      where: { spentAt: { gte: year.start, lte: year.end } },
      _sum: { amount: true },
      _count: true,
    }),
    isRememberedDevice(),
    hasPin(),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-bold">Back office</h1>
        <p className="text-sm text-muted-foreground">
          Financial year {year.label}. Invoicing, stock and finance follow; the expense log is
          live now.
        </p>
      </div>

      <Link
        href="/erp/expenses"
        className="flex items-center justify-between gap-4 rounded-2xl border bg-card p-5 transition hover:border-saffron"
      >
        <span className="flex items-center gap-4">
          <span className="flex size-12 items-center justify-center rounded-xl bg-accent text-saffron-deep">
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

      <DeviceSetup trusted={trusted && pinSet} />
    </div>
  );
}
