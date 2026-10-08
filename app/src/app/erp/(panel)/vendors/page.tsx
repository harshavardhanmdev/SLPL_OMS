export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { db } from "@/lib/db";
import { categoryLabel, financialYearOf } from "@/lib/expense-constants";
import { formatINR } from "@/lib/money";
import { getStaff, roleCan } from "@/lib/staff-auth";

export const metadata: Metadata = { title: "Vendors", robots: { index: false } };

const dateIN = (d: Date) =>
  d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });

/**
 * Everyone we pay, and what each costs us. A vendor with a due day is a
 * monthly payment: until something is paid to them this month it shows under
 * Due this month, and turns red once the day has passed.
 */
export default async function VendorsPage() {
  const staff = await getStaff();
  if (!staff || !roleCan(staff.role, "vendors.read")) redirect("/erp");
  // The CA reads; only an owner adds, changes or pays
  const canEdit = roleCan(staff.role, "staff.manage");

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const fy = financialYearOf(now);

  const [vendors, thisYear, thisMonth] = await Promise.all([
    db.vendor.findMany({ orderBy: [{ isActive: "desc" }, { name: "asc" }] }),
    db.expense.groupBy({
      by: ["vendorId"],
      // A voided payment stays in the log at zero, and counts for nothing here
      where: { vendorId: { not: null }, amount: { gt: 0 }, spentAt: { gte: fy.start, lte: fy.end } },
      _sum: { amount: true },
      _max: { spentAt: true },
    }),
    db.expense.findMany({
      where: { vendorId: { not: null }, amount: { gt: 0 }, spentAt: { gte: monthStart } },
      orderBy: { spentAt: "desc" },
      select: { vendorId: true, spentAt: true, amount: true },
    }),
  ]);

  const yearOf = new Map(thisYear.map((r) => [r.vendorId, r]));
  const recurring = vendors
    .filter((v) => v.isActive && v.recurringDay)
    .map((v) => {
      const paid = thisMonth.find((e) => e.vendorId === v.id);
      const due = new Date(now.getFullYear(), now.getMonth(), v.recurringDay!);
      return { ...v, paid, due, late: !paid && now > new Date(due.getTime() + 86400000) };
    })
    .sort((a, b) => Number(Boolean(a.paid)) - Number(Boolean(b.paid)) || a.due.getTime() - b.due.getTime());
  const owing = recurring.filter((r) => !r.paid);

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-heading text-2xl font-bold">Vendors</h1>
          <p className="text-sm text-muted-foreground">
            Everyone we pay. A payment recorded here goes straight into Expenses.
          </p>
        </div>
        {canEdit && (
          <Button className="gap-2" asChild>
            <Link href="/erp/vendors/new">
              <Plus className="size-4" /> Add a vendor
            </Link>
          </Button>
        )}
      </div>

      {recurring.length > 0 && (
        <section className="rounded-2xl border bg-card">
          <div className="border-b p-4">
            <h2 className="font-heading font-semibold">Due this month</h2>
            <p className="text-sm text-muted-foreground">
              {owing.length === 0
                ? "Every monthly payment is done."
                : `${owing.length} still to pay${
                    owing.some((o) => o.recurringAmount)
                      ? `, ${formatINR(owing.reduce((s, o) => s + (o.recurringAmount ?? 0), 0))} or more`
                      : ""
                  }.`}
            </p>
          </div>
          <ul className="divide-y">
            {recurring.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 p-4">
                <div className="min-w-0">
                  <Link href={`/erp/vendors/${r.id}`} className="font-medium hover:underline">
                    {r.name}
                  </Link>
                  <p className="text-sm text-muted-foreground">
                    {categoryLabel(r.category)} · due {dateIN(r.due)} ·{" "}
                    {r.recurringAmount ? formatINR(r.recurringAmount) : "amount varies"}
                  </p>
                </div>
                {r.paid ? (
                  <span className="rounded-full border border-green-300 bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800">
                    Paid {formatINR(r.paid.amount)} on {dateIN(r.paid.spentAt)}
                  </span>
                ) : (
                  <div className="flex items-center gap-2">
                    <span
                      className={
                        r.late
                          ? "rounded-full border border-destructive/40 bg-destructive/10 px-2 py-0.5 text-xs font-medium text-destructive"
                          : "rounded-full border border-saffron/40 bg-saffron/10 px-2 py-0.5 text-xs font-medium text-saffron-deep"
                      }
                    >
                      {r.late ? "Overdue" : "Due"}
                    </span>
                    {canEdit && (
                      <Button size="sm" asChild>
                        <Link href={`/erp/vendors/${r.id}#pay`}>Pay</Link>
                      </Button>
                    )}
                  </div>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="rounded-2xl border bg-card">
        <div className="border-b p-4">
          <h2 className="font-heading font-semibold">All vendors</h2>
          <p className="text-sm text-muted-foreground">Paid in {fy.label}, and the last payment.</p>
        </div>
        {vendors.length === 0 ? (
          <p className="p-6 text-center text-sm text-muted-foreground">No vendors yet. Add the first one.</p>
        ) : (
          <ul className="divide-y">
            {vendors.map((v) => {
              const y = yearOf.get(v.id);
              return (
                <li
                  key={v.id}
                  className={`flex flex-wrap items-center justify-between gap-2 p-4 ${v.isActive ? "" : "opacity-50"}`}
                >
                  <div className="min-w-0">
                    <Link href={`/erp/vendors/${v.id}`} className="font-medium hover:underline">
                      {v.name}
                    </Link>
                    <p className="text-sm text-muted-foreground">
                      {categoryLabel(v.category)}
                      {v.phone ? ` · ${v.phone}` : ""}
                      {v.isActive ? "" : " · no longer used"}
                    </p>
                  </div>
                  <div className="text-right text-sm">
                    <p className="font-semibold tabular-nums">{formatINR(y?._sum.amount ?? 0)}</p>
                    <p className="text-xs text-muted-foreground">
                      {y?._max.spentAt ? `last paid ${dateIN(y._max.spentAt)}` : "nothing paid this year"}
                    </p>
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
