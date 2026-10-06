export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Download, Plus, Receipt } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { db } from "@/lib/db";
import { formatINR } from "@/lib/money";
import { getStaff, roleCan } from "@/lib/staff-auth";

export const metadata: Metadata = { title: "Invoices", robots: { index: false } };

const tone: Record<string, string> = {
  DRAFT: "bg-muted text-muted-foreground border-border",
  PENDING_APPROVAL: "bg-saffron/20 text-saffron-deep border-saffron/40",
  APPROVED: "bg-navy/10 text-navy border-navy/30 dark:text-foreground",
  SENT: "bg-navy/10 text-navy border-navy/30 dark:text-foreground",
  PAID: "bg-green-100 text-green-800 border-green-300 dark:bg-green-950 dark:text-green-200",
  CANCELLED: "bg-muted text-muted-foreground border-border",
};

const label: Record<string, string> = {
  DRAFT: "Draft",
  PENDING_APPROVAL: "Waiting for approval",
  APPROVED: "Approved",
  SENT: "Sent",
  PAID: "Paid",
  CANCELLED: "Cancelled",
};

const dateIN = (d: Date) =>
  d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });

export default async function InvoicesPage() {
  const staff = await getStaff();
  if (!staff || !roleCan(staff.role, "crm.read")) redirect("/erp");
  const canWrite = roleCan(staff.role, "invoices.write");
  const canApprove = roleCan(staff.role, "invoices.approve");

  const invoices = await db.invoice.findMany({
    orderBy: { createdAt: "desc" },
    take: 200,
    include: {
      createdBy: { select: { name: true } },
      allocations: { select: { amount: true } },
    },
  });

  const waiting = invoices.filter((i) => i.status === "PENDING_APPROVAL");
  const billed = invoices.filter((i) => ["APPROVED", "SENT", "PAID"].includes(i.status));
  const outstanding = billed.reduce(
    (sum, i) => sum + Math.max(0, i.total - i.allocations.reduce((s, a) => s + a.amount, 0)),
    0,
  );

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-heading text-2xl font-bold">Invoices</h1>
          <p className="text-sm text-muted-foreground">
            Bills of supply for books, tax invoices the moment anything carries GST.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" className="gap-2" asChild>
            <Link href="/erp/export/invoices">
              <Download className="size-4" /> Excel
            </Link>
          </Button>
          {canWrite && (
            <Button className="gap-2" asChild>
              <Link href="/erp/invoices/new">
                <Plus className="size-4" /> New invoice
              </Link>
            </Button>
          )}
        </div>
      </div>

      {canApprove && waiting.length > 0 && (
        <p className="rounded-xl border border-saffron/40 bg-saffron/10 p-3 text-sm text-saffron-deep">
          {waiting.length} {waiting.length === 1 ? "invoice is" : "invoices are"} waiting for your
          approval.
        </p>
      )}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          ["Billed", formatINR(billed.reduce((s, i) => s + i.total, 0)), `${billed.length} bills`],
          ["Outstanding", formatINR(outstanding), "still to collect"],
          ["Waiting", String(waiting.length), "need approval"],
          ["Paid", String(invoices.filter((i) => i.status === "PAID").length), "settled in full"],
        ].map(([head, value, hint]) => (
          <div key={head} className="rounded-2xl border bg-card p-4">
            <p className="text-xs text-muted-foreground">{head}</p>
            <p className="font-heading text-xl font-bold">{value}</p>
            <p className="text-xs text-muted-foreground">{hint}</p>
          </div>
        ))}
      </div>

      {invoices.length === 0 ? (
        <div className="rounded-2xl border bg-card p-10 text-center">
          <Receipt className="mx-auto size-8 text-muted-foreground" />
          <p className="mt-3 font-medium">No invoices yet.</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {canWrite ? "Raise the first one." : "They appear here once raised."}
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {invoices.map((i) => {
            const received = i.allocations.reduce((s, a) => s + a.amount, 0);
            return (
              <li key={i.id}>
                <Link
                  href={`/erp/invoices/${i.id}`}
                  className="flex flex-wrap items-start justify-between gap-3 rounded-2xl border bg-card p-4 transition hover:border-saffron"
                >
                  <div className="min-w-0">
                    <p className="font-heading font-semibold">{i.customerName}</p>
                    <p className="mt-0.5 font-mono text-xs text-muted-foreground">{i.number}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {i.kind === "TAX_INVOICE" ? "Tax invoice" : "Bill of supply"} ·{" "}
                      {dateIN(i.invoiceDate)} · due {dateIN(i.dueDate)}
                      {i.createdBy ? ` · ${i.createdBy.name}` : ""}
                    </p>
                  </div>
                  <div className="text-right">
                    <Badge className={tone[i.status]}>{label[i.status] ?? i.status}</Badge>
                    <p className="mt-1 font-heading font-bold">{formatINR(i.total)}</p>
                    {received > 0 && received < i.total && (
                      <p className="text-xs text-muted-foreground">
                        {formatINR(i.total - received)} still due
                      </p>
                    )}
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
