export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { db } from "@/lib/db";
import { formatINR } from "@/lib/money";
import { getStaff, roleCan } from "@/lib/staff-auth";

export const metadata: Metadata = { title: "Sales returns", robots: { index: false } };

const dateIN = (d: Date) =>
  d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });

/** Goods schools sent back, newest first, and what each took off their balance. */
export default async function ReturnsPage() {
  const staff = await getStaff();
  if (!staff || !roleCan(staff.role, "invoices.read")) redirect("/erp");
  const canWrite = roleCan(staff.role, "finance.write");

  const returns = await db.salesReturn.findMany({
    orderBy: [{ returnedOn: "desc" }, { createdAt: "desc" }],
    take: 300,
    include: { invoice: { select: { number: true } } },
  });
  const credited = returns.reduce((s, r) => s + r.total - r.refunded, 0);

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-heading text-2xl font-bold">Sales returns</h1>
          <p className="text-sm text-muted-foreground">
            Goods a school sent back. Each comes off what that school owes, less anything paid back to them.
          </p>
        </div>
        {canWrite && (
          <Button className="gap-2" asChild>
            <Link href="/erp/returns/new">
              <Plus className="size-4" /> Record a return
            </Link>
          </Button>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-2xl border bg-card p-4">
          <p className="text-xs text-muted-foreground">Returns</p>
          <p className="font-heading text-xl font-bold">{returns.length}</p>
        </div>
        <div className="rounded-2xl border bg-card p-4">
          <p className="text-xs text-muted-foreground">Taken off school balances</p>
          <p className="font-heading text-xl font-bold">{formatINR(credited)}</p>
        </div>
      </div>

      {returns.length === 0 ? (
        <p className="rounded-2xl border bg-card p-8 text-center text-sm text-muted-foreground">
          No returns yet.
        </p>
      ) : (
        <ul className="divide-y rounded-2xl border bg-card">
          {returns.map((r) => (
            <li key={r.id}>
              <Link
                href={`/erp/returns/${r.id}`}
                className="flex flex-wrap items-start justify-between gap-2 p-4 hover:bg-muted/40"
              >
                <div className="min-w-0">
                  <p className="font-medium">{r.customerName}</p>
                  <p className="text-sm text-muted-foreground">
                    {r.number} · {dateIN(r.returnedOn)}
                    {r.invoice ? ` · against ${r.invoice.number}` : ""}
                  </p>
                </div>
                <div className="text-right text-sm">
                  <p className="font-semibold tabular-nums">{formatINR(r.total)}</p>
                  {r.refunded > 0 && (
                    <p className="text-xs text-muted-foreground">{formatINR(r.refunded)} paid back</p>
                  )}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
