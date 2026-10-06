export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";

import { PaymentForm, type OpenInvoice } from "@/components/erp/payment-form";
import { Button } from "@/components/ui/button";
import { db } from "@/lib/db";
import { BILLED_STATUSES } from "@/lib/ledger";
import { getStaff, roleCan } from "@/lib/staff-auth";

export const metadata: Metadata = { title: "Record a payment", robots: { index: false } };

const dateIN = (d: Date) =>
  d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });

export default async function NewPaymentPage({
  searchParams,
}: {
  searchParams: Promise<{ org?: string }>;
}) {
  const staff = await getStaff();
  if (!staff || !roleCan(staff.role, "finance.write")) redirect("/erp");
  const { org } = await searchParams;

  // Outstanding the same way the ledger works it out: billed less received,
  // in two grouped queries rather than one per school
  const [organizations, billed, received, invoices] = await Promise.all([
    db.organization.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    db.invoice.groupBy({
      by: ["organizationId"],
      where: { status: { in: [...BILLED_STATUSES] } },
      _sum: { total: true },
    }),
    db.receipt.groupBy({
      by: ["organizationId"],
      where: { voidedAt: null },
      _sum: { amount: true },
    }),
    // The same bills recordReceipt will settle, oldest first
    db.invoice.findMany({
      where: { organizationId: { not: null }, status: { in: ["APPROVED", "SENT"] } },
      orderBy: { invoiceDate: "asc" },
      select: {
        id: true,
        organizationId: true,
        number: true,
        invoiceDate: true,
        total: true,
        allocations: { select: { amount: true } },
      },
    }),
  ]);

  if (organizations.length === 0) {
    const canAdd = roleCan(staff.role, "crm.manage");
    return (
      <div className="mx-auto max-w-lg rounded-2xl border bg-card p-8 text-center">
        <p className="font-medium">No schools on the books yet.</p>
        <p className="mt-1 text-sm text-muted-foreground">
          A payment has to come from an organisation.
          {canAdd ? " Add the school first." : " Ask a manager to add the school first."}
        </p>
        {canAdd && (
          <Button className="mt-4" asChild>
            <Link href="/erp/organizations/new">Add a school</Link>
          </Button>
        )}
      </div>
    );
  }

  const billedBy = new Map(billed.map((b) => [b.organizationId, b._sum.total ?? 0]));
  const receivedBy = new Map(received.map((r) => [r.organizationId, r._sum.amount ?? 0]));

  const openInvoices: OpenInvoice[] = invoices
    .map((i) => ({
      id: i.id,
      organizationId: i.organizationId!,
      number: i.number,
      date: dateIN(i.invoiceDate),
      total: i.total,
      outstanding: i.total - i.allocations.reduce((s, a) => s + a.amount, 0),
    }))
    .filter((i) => i.outstanding > 0);

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <div>
        <Link
          href="/erp/payments"
          className="mb-1 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="size-4" /> Back to payments
        </Link>
        <h1 className="font-heading text-2xl font-bold">Record a payment</h1>
        <p className="text-sm text-muted-foreground">
          Money a school has actually paid. It gets a receipt number the moment you save.
        </p>
      </div>
      <PaymentForm
        organizations={organizations.map((o) => ({
          ...o,
          outstanding: (billedBy.get(o.id) ?? 0) - (receivedBy.get(o.id) ?? 0),
        }))}
        openInvoices={openInvoices}
        defaultOrgId={org}
      />
    </div>
  );
}
