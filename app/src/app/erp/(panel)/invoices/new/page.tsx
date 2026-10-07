export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";

import {
  InvoiceForm,
  QuotationStart,
  type BillableQuotation,
  type InvoiceDraft,
} from "@/components/erp/invoice-form";
import { db } from "@/lib/db";
import { formatINR } from "@/lib/money";
import { openVisits } from "@/lib/open-visits";
import { catalogForQuoting, organizationsForBilling } from "@/lib/quoting";
import { getStaff, roleCan } from "@/lib/staff-auth";

export const metadata: Metadata = { title: "New invoice", robots: { index: false } };

/**
 * An accepted quotation becomes the bill without retyping: same school, same
 * lines, same place of supply. A money discount on a quotation line is carried
 * as a lower rate, since the invoice prints MRP and rate rather than a
 * discount column.
 */
async function fromQuotation(id: string): Promise<InvoiceDraft | null> {
  const q = await db.quotation.findUnique({
    where: { id },
    include: { items: { orderBy: { sortOrder: "asc" } } },
  });
  if (!q?.organizationId) return null;
  return {
    organizationId: q.organizationId,
    // A magazine subscription is billed in the MAG series, as picking one on the form does
    productLine: q.items.some((i) => i.productId?.startsWith("magazine:"))
      ? "MAG"
      : q.items.every((i) => i.gstRate > 0)
        ? "SVC"
        : "BOOK",
    // The server runs on UTC, so ask for the date in India explicitly
    invoiceDate: new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date()),
    dueDays: "15",
    placeOfSupply: q.placeOfSupply,
    // The quotation's overall discount carries over; line discounts become a lower rate
    billDiscountBp: String(q.billDiscountBp),
    terms: [
      "Refunds and returns are as per signed MOU.",
      "All disputes are subject to Hyderabad jurisdiction only.",
    ].join("\n"),
    notes: `From quotation ${q.number}`,
    quotationId: q.id,
    visitId: "",
    lines: q.items.map((i) => {
      const gross = i.unitPrice * i.quantity;
      const off = i.discountAmount > 0 ? i.discountAmount : Math.round((gross * i.discountBp) / 10000);
      const rate = i.quantity > 0 ? (gross - off) / i.quantity : i.unitPrice;
      return {
        productId: i.productId,
        description: i.description,
        hsnCode: i.hsnCode ?? "",
        unit: i.unit,
        quantity: String(i.quantity),
        mrp: i.mrp ? String(i.mrp / 100) : off > 0 ? String(i.unitPrice / 100) : "",
        unitPrice: String(Math.round(rate) / 100),
        discountBp: "0",
        gstRate: String(i.gstRate),
        noBillDiscount: false,
      };
    }),
  };
}

/** Quotations ready to bill: approved, sent or accepted, and not billed yet. */
async function billableQuotations(): Promise<BillableQuotation[]> {
  const [quotations, billed] = await Promise.all([
    db.quotation.findMany({
      where: { status: { in: ["APPROVED", "SENT", "ACCEPTED"] }, organizationId: { not: null } },
      orderBy: { quotedOn: "desc" },
      take: 100,
      select: { id: true, number: true, customerName: true, total: true },
    }),
    db.invoice.findMany({ where: { quotationId: { not: null } }, select: { quotationId: true } }),
  ]);
  const done = new Set(billed.map((b) => b.quotationId));
  return quotations
    .filter((q) => !done.has(q.id))
    .map((q) => ({ id: q.id, label: `${q.number}, ${q.customerName}, ${formatINR(q.total)}` }));
}

export default async function NewInvoicePage({
  searchParams,
}: {
  searchParams: Promise<{ quotation?: string }>;
}) {
  const staff = await getStaff();
  if (!staff || !roleCan(staff.role, "invoices.write")) redirect("/erp/invoices");

  const { quotation } = await searchParams;
  const [catalog, organizations, visits, initial, quotations] = await Promise.all([
    catalogForQuoting(),
    organizationsForBilling(),
    openVisits(),
    quotation ? fromQuotation(quotation) : null,
    billableQuotations(),
  ]);

  if (organizations.length === 0) {
    return (
      <div className="mx-auto max-w-lg rounded-2xl border bg-card p-8 text-center">
        <p className="font-medium">No organisations yet.</p>
        <p className="mt-1 text-sm text-muted-foreground">
          A bill needs somebody to bill. Add the school first.
        </p>
        <Link href="/erp/organizations/new" className="mt-4 inline-block text-sm underline">
          Add an organisation
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <div>
        <Link
          href="/erp/invoices"
          className="mb-1 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="size-4" /> Back to invoices
        </Link>
        <h1 className="font-heading text-2xl font-bold">New invoice</h1>
        <p className="text-sm text-muted-foreground">
          Books are nil rated, so a books-only bill prints as a Bill of Supply. Add a workshop or
          anything else carrying GST and it becomes a Tax Invoice by itself.
        </p>
      </div>
      <QuotationStart quotations={quotations} current={initial ? quotation : undefined} />
      <InvoiceForm
        // A fresh form for each quotation picked, since the form keeps its own state
        key={quotation ?? "blank"}
        catalog={catalog}
        organizations={organizations}
        visits={visits}
        initial={initial ?? undefined}
      />
    </div>
  );
}
