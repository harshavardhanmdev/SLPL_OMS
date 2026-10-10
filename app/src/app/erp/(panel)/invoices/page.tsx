export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Download, Plus, Receipt } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { db } from "@/lib/db";
import { formatINR } from "@/lib/money";
import { invoiceWhere, salesTeam, schoolMoneyWhere } from "@/lib/money-scope";
import { getStaff, roleCan } from "@/lib/staff-auth";
import { monthKey, monthLabel, monthRange } from "@/lib/utils";

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

export default async function InvoicesPage({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  const staff = await getStaff();
  if (!staff || !roleCan(staff.role, "invoices.read")) redirect("/erp");
  const canWrite = roleCan(staff.role, "invoices.write");
  const canApprove = roleCan(staff.role, "invoices.approve");

  // Sales see their own schools' bills, not the whole company's
  const team = await salesTeam(staff);
  const scope = invoiceWhere(team);
  const canSeeReceipts = roleCan(staff.role, "finance.read");
  const { month: rawMonth } = await searchParams;
  const range = monthRange(rawMonth);
  const month = range ? rawMonth : undefined;

  // Money comes in the month it was received, whichever month its bill is from
  const paymentScope = { voidedAt: null, ...schoolMoneyWhere(team) };

  // How many bills fall in each month, for the filter, and the months with only payments
  const perMonth = new Map<string, number>();
  for (const i of await db.invoice.findMany({ where: scope, select: { invoiceDate: true } })) {
    const key = monthKey(i.invoiceDate);
    perMonth.set(key, (perMonth.get(key) ?? 0) + 1);
  }
  for (const r of await db.receipt.findMany({ where: paymentScope, select: { receivedOn: true } })) {
    const key = monthKey(r.receivedOn);
    if (!perMonth.has(key)) perMonth.set(key, 0);
  }
  const months = [...perMonth.entries()].sort((a, b) => b[0].localeCompare(a[0]));

  const invoices = await db.invoice.findMany({
    where: { ...scope, ...(range ? { invoiceDate: range } : {}) },
    orderBy: [{ invoiceDate: "desc" }, { createdAt: "desc" }],
    take: 500,
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

  const payments = await db.receipt.findMany({
    where: { ...paymentScope, ...(range ? { receivedOn: range } : {}) },
    orderBy: [{ receivedOn: "desc" }, { createdAt: "desc" }],
    take: 500,
    include: {
      organization: { select: { name: true } },
      allocations: { include: { invoice: { select: { id: true, number: true } } } },
    },
  });
  const receivedAll = payments.reduce((sum, r) => sum + r.amount, 0);

  // Divided by month, newest first: the bills dated that month, and the
  // payments received that month
  const groups: { key: string; rows: typeof invoices; paid: typeof payments }[] = [];
  const groupFor = (key: string) => {
    let group = groups.find((g) => g.key === key);
    if (!group) groups.push((group = { key, rows: [], paid: [] }));
    return group;
  };
  for (const i of invoices) groupFor(monthKey(i.invoiceDate)).rows.push(i);
  for (const r of payments) groupFor(monthKey(r.receivedOn)).paid.push(r);
  groups.sort((a, b) => b.key.localeCompare(a.key));

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
            <Link href={`/erp/export/invoices${month ? `?month=${month}` : ""}`}>
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

      {months.length > 1 && (
        <form className="flex flex-wrap gap-2" action="/erp/invoices">
          <select
            name="month"
            aria-label="Month"
            defaultValue={month ?? ""}
            className="flex h-11 rounded-md border border-input bg-transparent px-3 text-sm"
          >
            <option value="">Every month</option>
            {months.map(([key, count]) => (
              <option key={key} value={key}>
                {monthLabel(key)}
                {count ? ` (${count})` : ""}
              </option>
            ))}
          </select>
          <Button type="submit" variant="outline" className="h-11">
            Show
          </Button>
        </form>
      )}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {[
          [
            "Billed",
            formatINR(billed.reduce((s, i) => s + i.total, 0)),
            `${billed.length} bills${month ? ` in ${monthLabel(month)}` : ""}`,
          ],
          ["Received", formatINR(receivedAll), month ? `in ${monthLabel(month)}` : "every payment"],
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

      {groups.length === 0 ? (
        <div className="rounded-2xl border bg-card p-10 text-center">
          <Receipt className="mx-auto size-8 text-muted-foreground" />
          <p className="mt-3 font-medium">No invoices yet.</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {canWrite ? "Raise the first one." : "They appear here once raised."}
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {groups.map((g) => (
            <section key={g.key} aria-label={monthLabel(g.key)} className="space-y-3">
              <h2 className="flex flex-wrap items-baseline justify-between gap-2 border-b pb-1 font-heading font-semibold">
                {monthLabel(g.key)}
                <span className="text-sm font-normal text-muted-foreground">
                  {[
                    g.rows.length > 0 &&
                      `${g.rows.length} ${g.rows.length === 1 ? "invoice" : "invoices"} · ${formatINR(
                        g.rows
                          .filter((i) => ["APPROVED", "SENT", "PAID"].includes(i.status))
                          .reduce((sum, i) => sum + i.total, 0),
                      )} billed`,
                    g.paid.length > 0 && `${formatINR(g.paid.reduce((sum, r) => sum + r.amount, 0))} received`,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
              </h2>
              <ul className="space-y-3 empty:hidden">
                {g.rows.map((i) => {
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
                              {formatINR(received)} received · {formatINR(i.total - received)} still due
                            </p>
                          )}
                        </div>
                      </Link>
                    </li>
                  );
                })}
              </ul>
              {g.paid.length > 0 && (
                <div className="rounded-2xl border bg-card">
                  <p className="border-b px-4 py-2 text-sm font-semibold">
                    Payments received in {monthLabel(g.key)}
                  </p>
                  <ul className="divide-y">
                    {g.paid.map((r) => (
                      <li key={r.id} className="flex flex-wrap items-start justify-between gap-2 px-4 py-3">
                        <div className="min-w-0 text-sm">
                          <p className="font-medium">{r.organization.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {dateIN(r.receivedOn)} ·{" "}
                            {canSeeReceipts ? (
                              <Link href={`/erp/payments/${r.id}`} className="underline">
                                {r.number}
                              </Link>
                            ) : (
                              r.number
                            )}
                            {r.allocations.length > 0 && (
                              <>
                                {" "}
                                · against{" "}
                                {r.allocations.map((a, n) => (
                                  <span key={a.id}>
                                    {n > 0 && ", "}
                                    <Link href={`/erp/invoices/${a.invoice.id}`} className="font-mono underline">
                                      {a.invoice.number}
                                    </Link>
                                  </span>
                                ))}
                              </>
                            )}
                          </p>
                        </div>
                        <span className="font-heading font-bold text-green-700 dark:text-green-400">
                          {formatINR(r.amount)}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
