export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  CalendarClock,
  ChevronLeft,
  Gift as GiftIcon,
  Package,
  Pencil,
  Truck,
  Wallet,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { db } from "@/lib/db";
import { accountPosition, BILLED_STATUSES } from "@/lib/ledger";
import { formatINR } from "@/lib/money";
import { PAYMENT_MODE_LABEL } from "@/lib/payment-modes";
import { getStaff, roleCan } from "@/lib/staff-auth";

export const metadata: Metadata = { title: "Organisation", robots: { index: false } };

const dateIN = (d: Date) =>
  d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });

const statusText = (status: string) => status.toLowerCase().replace(/_/g, " ");

type Entry = {
  at: Date;
  icon: typeof CalendarClock;
  title: string;
  detail: string;
  href?: string;
  badge?: { text: string; tone: string };
};

/**
 * One school, and everything about it on one screen: what it owes, what we
 * still owe it, and every quotation, bill and payment in its own section.
 *
 * This is the screen the owner actually asked for: open an organisation and
 * see the whole history rather than hunting through five separate tables.
 */
export default async function OrganizationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const staff = await getStaff();
  if (!staff || !roleCan(staff.role, "crm.read")) redirect("/erp");
  const canManage = roleCan(staff.role, "crm.manage");
  const canWrite = roleCan(staff.role, "crm.write");
  const canTakeMoney = roleCan(staff.role, "finance.write");
  const canChallan = roleCan(staff.role, "challan.write");

  const org = await db.organization.findUnique({
    where: { id },
    include: {
      owner: { select: { name: true } },
      visits: { orderBy: { visitedOn: "desc" }, include: { by: { select: { name: true } } } },
      quotations: { orderBy: { quotedOn: "desc" } },
      invoices: {
        orderBy: { invoiceDate: "desc" },
        include: { allocations: { select: { amount: true } }, challans: { select: { id: true } } },
      },
      receipts: {
        where: { voidedAt: null },
        orderBy: { receivedOn: "desc" },
        include: { allocations: { include: { invoice: { select: { id: true, number: true } } } } },
      },
      samples: { orderBy: { issuedOn: "desc" } },
      gifts: { orderBy: { givenOn: "desc" } },
      challans: { orderBy: { dispatchedOn: "desc" }, include: { items: { select: { quantity: true } } } },
    },
  });
  if (!org) notFound();

  const [position, subscriptions] = await Promise.all([
    accountPosition(org.id),
    db.subscription.findMany({
      where: { invoice: { organizationId: org.id } },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  // Quotations, bills and payments have sections of their own; this is the rest
  const timeline: Entry[] = [
    ...org.visits.map((v) => ({
      at: v.visitedOn,
      icon: CalendarClock,
      title: `${v.kind.toLowerCase().replace("_", " ")}${v.metWith ? ` with ${v.metWith}` : ""}`,
      detail: `${v.summary}${v.nextAction ? ` · Next: ${v.nextAction} on ${dateIN(v.nextActionOn)}` : ""}${v.by ? ` · ${v.by.name}` : ""}`,
      badge: v.converted
        ? { text: "Converted", tone: "border-green-300 bg-green-100 text-green-800" }
        : undefined,
    })),
    ...org.challans.map((c) => ({
      at: c.dispatchedOn,
      icon: Truck,
      title: `Delivery challan ${c.number}`,
      detail: `${c.items.reduce((s, i) => s + i.quantity, 0)} items to ${c.toName}${c.vehicleNumber ? ` · ${c.vehicleNumber}` : ""}`,
      href: `/erp/challans/${c.id}`,
    })),
    ...org.samples.map((s) => ({
      at: s.givenOn ?? s.issuedOn,
      icon: Package,
      title: `Sample: ${s.description}`,
      detail: `${s.quantity} left with them · ${s.status.toLowerCase().replace("_", " ")}`,
    })),
    ...org.gifts.map((g) => ({
      at: g.givenOn,
      icon: GiftIcon,
      title: `Gift: ${g.description}`,
      detail: [g.givenToName, g.value ? formatINR(g.value) : null].filter(Boolean).join(" · ") || "No value recorded",
    })),
  ].sort((a, b) => b.at.getTime() - a.at.getTime());

  const samplesOut = org.samples
    .filter((s) => s.status === "WITH_SCHOOL")
    .reduce((sum, s) => sum + s.quantity, 0);

  const billedStatuses: string[] = [...BILLED_STATUSES];
  const bills = org.invoices.map((i) => {
    const received = i.allocations.reduce((s, a) => s + a.amount, 0);
    const counts = billedStatuses.includes(i.status);
    return { ...i, received, balance: counts ? i.total - received : 0, counts };
  });
  const billedFrom = new Map(
    org.invoices.filter((i) => i.quotationId).map((i) => [i.quotationId!, i]),
  );
  const openQuotes = org.quotations.filter(
    (q) => ["PENDING_APPROVAL", "APPROVED", "SENT", "ACCEPTED"].includes(q.status) && !billedFrom.has(q.id),
  );

  // What we still owe them: books billed but not yet sent with a challan,
  // magazine issues still to post, and money paid ahead of any bill
  const undelivered = bills.filter((b) => b.counts && b.productLine === "BOOK" && b.challans.length === 0);
  const toPost = subscriptions.filter((s) => s.status === "ACTIVE" && s.issuesSent < s.issuesTotal);
  const credit = Math.max(0, -position.outstanding);
  const owed = undelivered.length + toPost.length + (credit > 0 ? 1 : 0);

  const sections = [
    ["deliver", "Still to give them", owed],
    ["quotations", "Quotations", org.quotations.length],
    ["invoices", "Invoices", org.invoices.length],
    ["payments", "Payments", org.receipts.length],
    ["history", "History", timeline.length],
  ] as const;

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link
            href="/erp/organizations"
            className="mb-1 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <ChevronLeft className="size-4" /> Back to organisations
          </Link>
          <h1 className="font-heading text-2xl font-bold">
            {org.name}
            <span className="ml-2 font-mono text-sm font-normal text-muted-foreground">
              {org.code}
            </span>
          </h1>
          <p className="text-sm text-muted-foreground">
            {[org.contactPerson && `${org.contactPerson}${org.designation ? `, ${org.designation}` : ""}`, org.phone, org.email]
              .filter(Boolean)
              .join(" · ") || "No contact recorded"}
          </p>
          <p className="text-xs text-muted-foreground">
            {[org.addressLine, org.city, org.state, org.pincode].filter(Boolean).join(", ")}
            {org.gstin ? ` · GSTIN ${org.gstin}` : ""}
            {org.owner ? ` · looked after by ${org.owner.name}` : ""}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {canWrite && (
            <Button size="sm" className="gap-1.5" asChild>
              <Link href={`/erp/visits/new?org=${org.id}`}>
                <CalendarClock className="size-3.5" /> Log a visit
              </Link>
            </Button>
          )}
          {canTakeMoney && (
            <Button size="sm" variant="outline" className="gap-1.5" asChild>
              <Link href={`/erp/payments/new?org=${org.id}`}>
                <Wallet className="size-3.5" /> Record a payment
              </Link>
            </Button>
          )}
          {canManage && (
            <Button size="sm" variant="outline" className="gap-1.5" asChild>
              <Link href={`/erp/organizations/${org.id}/edit`}>
                <Pencil className="size-3.5" /> Edit
              </Link>
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {[
          ["Billed", formatINR(position.billed), `${org.invoices.length} bills`],
          ["Received", formatINR(position.received), `${org.receipts.length} payments`],
          credit > 0
            ? ["In credit", formatINR(credit), "paid ahead, held for them"]
            : [
                "Balance due",
                formatINR(Math.max(0, position.outstanding)),
                position.oldestUnpaidOn ? `oldest ${position.oldestUnpaidDays} days` : "nothing owing",
              ],
          [
            "Open quotations",
            formatINR(openQuotes.reduce((s, q) => s + q.total, 0)),
            `${openQuotes.length} not billed yet`,
          ],
          ["Samples out", String(samplesOut), "still with them"],
        ].map(([head, value, hint]) => (
          <div key={head} className="rounded-2xl border bg-card p-4">
            <p className="text-xs text-muted-foreground">{head}</p>
            <p className="font-heading text-xl font-bold">{value}</p>
            <p className="text-xs text-muted-foreground">{hint}</p>
          </div>
        ))}
      </div>

      <nav aria-label="Sections" className="flex flex-wrap gap-2">
        {sections.map(([anchor, label, count]) => (
          <a
            key={anchor}
            href={`#${anchor}`}
            className="rounded-full border bg-card px-3 py-1.5 text-sm hover:bg-muted"
          >
            {label} <span className="tabular-nums text-muted-foreground">{count}</span>
          </a>
        ))}
      </nav>

      <section id="deliver" className="scroll-mt-20 rounded-2xl border bg-card">
        <div className="border-b p-4">
          <h2 className="font-heading font-semibold">Still to give them</h2>
          <p className="text-sm text-muted-foreground">
            Books billed but not yet sent with a delivery challan, magazine issues still to post,
            and any money they paid ahead.
          </p>
        </div>
        {owed === 0 ? (
          <p className="p-6 text-center text-sm text-muted-foreground">Nothing owed to them.</p>
        ) : (
          <ul className="divide-y">
            {undelivered.map((b) => (
              <li key={b.id} className="flex flex-wrap items-center justify-between gap-2 p-4">
                <div>
                  <Link href={`/erp/invoices/${b.id}`} className="font-medium hover:underline">
                    {b.number}
                  </Link>
                  <p className="text-sm text-muted-foreground">
                    Billed {dateIN(b.invoiceDate)}, no delivery challan yet
                  </p>
                </div>
                {canChallan && (
                  <Button size="sm" variant="outline" className="gap-1.5" asChild>
                    <Link href={`/erp/challans/new?invoiceId=${b.id}`}>
                      <Truck className="size-3.5" /> Raise the challan
                    </Link>
                  </Button>
                )}
              </li>
            ))}
            {toPost.map((s) => (
              <li key={s.id} className="p-4">
                <p className="font-medium">
                  The GenZ Times, {s.copies} {s.copies === 1 ? "copy" : "copies"} of each issue
                </p>
                <p className="text-sm text-muted-foreground">
                  {s.issuesTotal - s.issuesSent} of {s.issuesTotal} issues still to post, from{" "}
                  {s.startIssue} · {s.code}
                </p>
              </li>
            ))}
            {credit > 0 && (
              <li className="p-4">
                <p className="font-medium">{formatINR(credit)} held on their account</p>
                <p className="text-sm text-muted-foreground">
                  Paid ahead of any bill. It settles the next invoice raised for them.
                </p>
              </li>
            )}
          </ul>
        )}
      </section>

      <section id="quotations" className="scroll-mt-20 rounded-2xl border bg-card">
        <div className="border-b p-4">
          <h2 className="font-heading font-semibold">Quotations</h2>
        </div>
        {org.quotations.length === 0 ? (
          <p className="p-6 text-center text-sm text-muted-foreground">No quotations yet.</p>
        ) : (
          <ul className="divide-y">
            {org.quotations.map((q) => {
              const bill = billedFrom.get(q.id);
              return (
                <li key={q.id} className="flex flex-wrap items-start justify-between gap-2 p-4">
                  <div className="min-w-0">
                    <Link href={`/erp/quotations/${q.id}`} className="font-medium hover:underline">
                      {q.number}
                    </Link>
                    <p className="text-sm text-muted-foreground">
                      {dateIN(q.quotedOn)} · {statusText(q.status)}
                      {bill && (
                        <>
                          {" · billed as "}
                          <Link href={`/erp/invoices/${bill.id}`} className="underline">
                            {bill.number}
                          </Link>
                        </>
                      )}
                    </p>
                  </div>
                  <span className="font-semibold tabular-nums">{formatINR(q.total)}</span>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section id="invoices" className="scroll-mt-20 rounded-2xl border bg-card">
        <div className="border-b p-4">
          <h2 className="font-heading font-semibold">Invoices</h2>
        </div>
        {bills.length === 0 ? (
          <p className="p-6 text-center text-sm text-muted-foreground">No invoices yet.</p>
        ) : (
          <ul className="divide-y">
            {bills.map((b) => (
              <li key={b.id} className="flex flex-wrap items-start justify-between gap-2 p-4">
                <div className="min-w-0">
                  <Link href={`/erp/invoices/${b.id}`} className="font-medium hover:underline">
                    {b.number}
                  </Link>
                  <p className="text-sm text-muted-foreground">
                    {dateIN(b.invoiceDate)} · {statusText(b.status)}
                    {b.counts && b.balance > 0 ? ` · due ${dateIN(b.dueDate)}` : ""}
                  </p>
                </div>
                <div className="text-right text-sm">
                  <p className="font-semibold tabular-nums">{formatINR(b.total)}</p>
                  {b.counts && (
                    <p className="tabular-nums text-muted-foreground">
                      {b.balance > 0
                        ? `${formatINR(b.received)} received, ${formatINR(b.balance)} to collect`
                        : "paid in full"}
                    </p>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section id="payments" className="scroll-mt-20 rounded-2xl border bg-card">
        <div className="border-b p-4">
          <h2 className="font-heading font-semibold">Payments received</h2>
        </div>
        {org.receipts.length === 0 ? (
          <p className="p-6 text-center text-sm text-muted-foreground">No payments yet.</p>
        ) : (
          <ul className="divide-y">
            {org.receipts.map((r) => (
              <li key={r.id} className="flex flex-wrap items-start justify-between gap-2 p-4">
                <div className="min-w-0">
                  <Link href={`/erp/payments/${r.id}`} className="font-medium hover:underline">
                    {r.number}
                  </Link>
                  <p className="text-sm text-muted-foreground">
                    {dateIN(r.receivedOn)} · {PAYMENT_MODE_LABEL[r.mode] ?? r.mode}
                    {r.reference ? ` · ${r.reference}` : ""}
                  </p>
                  {r.allocations.length > 0 && (
                    <p className="text-xs text-muted-foreground">
                      Settled{" "}
                      {r.allocations.map((a, i) => (
                        <span key={a.id}>
                          {i > 0 && ", "}
                          <Link href={`/erp/invoices/${a.invoice.id}`} className="underline">
                            {a.invoice.number}
                          </Link>{" "}
                          {formatINR(a.amount)}
                        </span>
                      ))}
                    </p>
                  )}
                </div>
                <span className="font-semibold tabular-nums text-green-700 dark:text-green-400">
                  {formatINR(r.amount)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section id="history" className="scroll-mt-20 rounded-2xl border bg-card">
        <div className="border-b p-4">
          <h2 className="font-heading font-semibold">History</h2>
          <p className="text-sm text-muted-foreground">
            Visits, delivery challans, samples and gifts, newest first.
          </p>
        </div>
        {timeline.length === 0 ? (
          <p className="p-8 text-center text-sm text-muted-foreground">
            Nothing recorded yet. Log the first visit.
          </p>
        ) : (
          <ul className="divide-y">
            {timeline.map((e, i) => (
              <li key={i} className="flex gap-3 p-4">
                <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg bg-accent text-saffron-deep">
                  <e.icon className="size-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-2 font-medium capitalize">
                    {e.href ? (
                      <Link href={e.href} className="hover:underline">
                        {e.title}
                      </Link>
                    ) : (
                      e.title
                    )}
                    {e.badge && <Badge className={e.badge.tone}>{e.badge.text}</Badge>}
                  </p>
                  <p className="text-sm text-muted-foreground">{e.detail}</p>
                </div>
                <span className="shrink-0 text-xs text-muted-foreground">{dateIN(e.at)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
