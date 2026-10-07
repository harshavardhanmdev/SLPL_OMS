export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";

import { InvoiceForm } from "@/components/erp/invoice-form";
import { db } from "@/lib/db";
import { openVisits } from "@/lib/open-visits";
import { catalogForQuoting, organizationsForBilling } from "@/lib/quoting";
import { getStaff, roleCan } from "@/lib/staff-auth";

export const metadata: Metadata = { title: "Edit invoice", robots: { index: false } };

export default async function EditInvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const staff = await getStaff();
  if (!staff || !roleCan(staff.role, "invoices.write")) redirect("/erp/invoices");

  const [invoice, catalog, organizations, visits] = await Promise.all([
    db.invoice.findUnique({ where: { id }, include: { items: { orderBy: { sortOrder: "asc" } } } }),
    catalogForQuoting(),
    organizationsForBilling(),
    openVisits(),
  ]);
  if (!invoice) notFound();
  // Once approved, the figures a school is holding must not change underneath
  if (!["DRAFT", "PENDING_APPROVAL"].includes(invoice.status)) redirect(`/erp/invoices/${id}`);

  const dueDays = Math.max(
    0,
    Math.round((invoice.dueDate.getTime() - invoice.invoiceDate.getTime()) / 86400000),
  );

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <div>
        <Link
          href={`/erp/invoices/${id}`}
          className="mb-1 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="size-4" /> Back to the invoice
        </Link>
        <h1 className="font-heading text-2xl font-bold">Edit {invoice.number}</h1>
      </div>
      <InvoiceForm
        catalog={catalog}
        organizations={organizations}
        visits={visits}
        initial={{
          id: invoice.id,
          organizationId: invoice.organizationId ?? "",
          productLine: invoice.productLine,
          invoiceDate: invoice.invoiceDate.toISOString().slice(0, 10),
          dueDays: String(dueDays),
          placeOfSupply: invoice.placeOfSupply,
          billDiscountBp: String(invoice.billDiscountBp),
          terms: invoice.terms ?? "",
          notes: invoice.notes ?? "",
          quotationId: invoice.quotationId,
          visitId: "",
          lines: invoice.items.map((i) => ({
            productId: i.productId,
            description: i.description,
            hsnCode: i.hsnCode ?? "",
            unit: i.unit,
            quantity: String(i.quantity),
            mrp: i.mrp ? (i.mrp / 100).toString() : "",
            unitPrice: (i.unitPrice / 100).toString(),
            discountBp: String(i.discountBp),
            gstRate: String(i.gstRate),
            noBillDiscount: i.noBillDiscount,
          })),
        }}
      />
    </div>
  );
}
