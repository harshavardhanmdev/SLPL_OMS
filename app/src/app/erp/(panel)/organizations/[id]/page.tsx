export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  CalendarClock,
  ChevronLeft,
  FileSignature,
  Gift as GiftIcon,
  Package,
  Pencil,
  Receipt as ReceiptIcon,
  Truck,
  Wallet,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { db } from "@/lib/db";
import { accountPosition } from "@/lib/ledger";
import { formatINR } from "@/lib/money";
import { PAYMENT_MODE_LABEL } from "@/lib/payment-modes";
import { getStaff, roleCan } from "@/lib/staff-auth";

export const metadata: Metadata = { title: "Organisation", robots: { index: false } };

const dateIN = (d: Date) =>
  d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });

type Entry = {
  at: Date;
  icon: typeof CalendarClock;
  title: string;
  detail: string;
  href?: string;
  badge?: { text: string; tone: string };
};

/**
 * One school, and everything that has ever happened with it in one list.
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

  const org = await db.organization.findUnique({
    where: { id },
    include: {
      owner: { select: { name: true } },
      visits: { orderBy: { visitedOn: "desc" }, include: { by: { select: { name: true } } } },
      quotations: { orderBy: { quotedOn: "desc" } },
      invoices: { orderBy: { invoiceDate: "desc" } },
      receipts: { where: { voidedAt: null }, orderBy: { receivedOn: "desc" } },
      samples: { orderBy: { issuedOn: "desc" } },
      gifts: { orderBy: { givenOn: "desc" } },
      challans: { orderBy: { dispatchedOn: "desc" }, include: { items: { select: { quantity: true } } } },
    },
  });
  if (!org) notFound();

  const position = await accountPosition(org.id);

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
    ...org.quotations.map((q) => ({
      at: q.quotedOn,
      icon: FileSignature,
      title: `Quotation ${q.number}`,
      detail: `${formatINR(q.total)} · ${q.status.toLowerCase().replace("_", " ")}`,
      href: `/erp/quotations/${q.id}`,
    })),
    ...org.invoices.map((i) => ({
      at: i.invoiceDate,
      icon: ReceiptIcon,
      title: `${i.kind === "TAX_INVOICE" ? "Tax invoice" : "Bill of supply"} ${i.number}`,
      detail: `${formatINR(i.total)} · ${i.status.toLowerCase().replace("_", " ")}`,
      href: `/erp/invoices/${i.id}`,
    })),
    ...org.receipts.map((r) => ({
      at: r.receivedOn,
      icon: ReceiptIcon,
      title: `Received ${formatINR(r.amount)}`,
      detail: `${r.number} · ${PAYMENT_MODE_LABEL[r.mode] ?? r.mode}${r.reference ? ` · ${r.reference}` : ""}`,
      badge: { text: "Payment", tone: "border-green-300 bg-green-100 text-green-800" },
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

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          ["Billed", formatINR(position.billed), `${org.invoices.length} bills`],
          ["Received", formatINR(position.received), `${org.receipts.length} payments`],
          [
            "Outstanding",
            formatINR(Math.max(0, position.outstanding)),
            position.oldestUnpaidOn
              ? `oldest ${position.oldestUnpaidDays} days`
              : "nothing owing",
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

      <section className="rounded-2xl border bg-card">
        <div className="border-b p-4">
          <h2 className="font-heading font-semibold">Everything that has happened</h2>
          <p className="text-sm text-muted-foreground">
            Visits, quotations, bills, payments, challans, samples and gifts, newest first.
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
