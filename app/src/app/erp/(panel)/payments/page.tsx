export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Download, Plus, Wallet } from "lucide-react";

import { VoidReceipt } from "@/components/erp/void-receipt";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { db } from "@/lib/db";
import { formatINR } from "@/lib/money";
import { PAYMENT_MODE_LABEL } from "@/lib/payment-modes";
import { getStaff, roleCan } from "@/lib/staff-auth";

export const metadata: Metadata = { title: "Payments", robots: { index: false } };

const dateIN = (d: Date) =>
  d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });

/**
 * Money received, newest first.
 *
 * Voided payments stay in the list with their reason, because the number
 * series has to read straight through when an auditor asks about a gap.
 */
export default async function PaymentsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const staff = await getStaff();
  if (!staff || !roleCan(staff.role, "finance.read")) redirect("/erp");
  const canWrite = roleCan(staff.role, "finance.write");
  // The school and invoice screens, and the export, sit behind crm.read
  const canSeeSchools = roleCan(staff.role, "crm.read");

  const { q } = await searchParams;
  const term = q?.trim() ?? "";

  const receipts = await db.receipt.findMany({
    where: term
      ? {
          OR: [
            { number: { contains: term, mode: "insensitive" } },
            { organization: { name: { contains: term, mode: "insensitive" } } },
          ],
        }
      : {},
    orderBy: [{ receivedOn: "desc" }, { createdAt: "desc" }],
    take: 200,
    include: {
      organization: { select: { id: true, name: true } },
      allocations: { include: { invoice: { select: { id: true, number: true } } } },
    },
  });

  const live = receipts.filter((r) => !r.voidedAt);
  const total = live.reduce((s, r) => s + r.amount, 0);

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-heading text-2xl font-bold">Payments</h1>
          <p className="text-sm text-muted-foreground">
            Money received from schools, and the bills each payment settled.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {canSeeSchools && (
            <Button variant="outline" className="gap-2" asChild>
              <Link href="/erp/export/receipts">
                <Download className="size-4" /> Download
              </Link>
            </Button>
          )}
          {canWrite && (
            <Button className="gap-2" asChild>
              <Link href="/erp/payments/new">
                <Plus className="size-4" /> Record a payment
              </Link>
            </Button>
          )}
        </div>
      </div>

      <form className="flex flex-wrap gap-2" action="/erp/payments">
        <Input
          name="q"
          defaultValue={term}
          placeholder="School name or receipt number"
          className="h-11 max-w-xs"
        />
        <Button type="submit" variant="outline" className="h-11">
          Search
        </Button>
        {term && (
          <Button variant="ghost" className="h-11" asChild>
            <Link href="/erp/payments">Clear</Link>
          </Button>
        )}
      </form>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {[
          ["Received", formatINR(total), term ? `matching "${term}"` : "in the payments shown"],
          ["Payments", String(live.length), "counted in that total"],
          ["Voided", String(receipts.length - live.length), "kept for the record"],
        ].map(([head, value, hint]) => (
          <div key={head} className="rounded-2xl border bg-card p-4">
            <p className="text-xs text-muted-foreground">{head}</p>
            <p className="font-heading text-xl font-bold">{value}</p>
            <p className="text-xs text-muted-foreground">{hint}</p>
          </div>
        ))}
      </div>

      {receipts.length === 0 ? (
        <div className="rounded-2xl border bg-card p-10 text-center">
          <Wallet className="mx-auto size-8 text-muted-foreground" />
          <p className="mt-3 font-medium">
            {term ? "No payment matches that search." : "No payments recorded yet."}
          </p>
          {canWrite && !term && (
            <Button className="mt-4 gap-2" asChild>
              <Link href="/erp/payments/new">
                <Plus className="size-4" /> Record the first one
              </Link>
            </Button>
          )}
        </div>
      ) : (
        <ul className="space-y-3">
          {receipts.map((r) => {
            const allocated = r.allocations.reduce((s, a) => s + a.amount, 0);
            const onAccount = r.amount - allocated;
            return (
              <li
                key={r.id}
                className={`rounded-2xl border bg-card p-4 ${r.voidedAt ? "opacity-75" : ""}`}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-heading font-semibold">
                      {canSeeSchools ? (
                        <Link href={`/erp/organizations/${r.organization.id}`} className="hover:underline">
                          {r.organization.name}
                        </Link>
                      ) : (
                        r.organization.name
                      )}
                    </p>
                    <Link href={`/erp/payments/${r.id}`} className="mt-0.5 block font-mono text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline">
                      {r.number} · receipt
                    </Link>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {dateIN(r.receivedOn)} · {PAYMENT_MODE_LABEL[r.mode] ?? r.mode}
                      {r.reference ? ` · Ref ${r.reference}` : ""}
                    </p>
                  </div>
                  <div className="text-right">
                    {r.voidedAt && (
                      <Badge className="border-destructive/40 bg-destructive/10 text-destructive">
                        Voided
                      </Badge>
                    )}
                    <p className={`mt-1 font-heading font-bold ${r.voidedAt ? "line-through" : ""}`}>
                      {formatINR(r.amount)}
                    </p>
                  </div>
                </div>

                {r.voidedAt ? (
                  <p className="mt-2 text-sm text-destructive">
                    Voided on {dateIN(r.voidedAt)}: {r.voidReason}
                  </p>
                ) : (
                  <div className="mt-2 flex flex-wrap items-end justify-between gap-2">
                    <p className="text-sm text-muted-foreground">
                      {r.allocations.length > 0 ? "Settled " : ""}
                      {r.allocations.map((a, i) => (
                        <span key={a.id}>
                          {i > 0 ? ", " : ""}
                          {canSeeSchools ? (
                            <Link href={`/erp/invoices/${a.invoice.id}`} className="font-mono text-xs hover:underline">
                              {a.invoice.number}
                            </Link>
                          ) : (
                            <span className="font-mono text-xs">{a.invoice.number}</span>
                          )}{" "}
                          ({formatINR(a.amount)})
                        </span>
                      ))}
                      {onAccount > 0 &&
                        `${r.allocations.length > 0 ? ", and " : ""}${formatINR(onAccount)} held on their account`}
                    </p>
                    {canWrite && <VoidReceipt id={r.id} number={r.number} />}
                  </div>
                )}
                {r.notes && <p className="mt-1 text-xs text-muted-foreground">{r.notes}</p>}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
