export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";

import { QuotationForm } from "@/components/erp/quotation-form";
import { db } from "@/lib/db";
import { catalogForQuoting, organizationsForBilling } from "@/lib/quoting";
import { getStaff, roleCan } from "@/lib/staff-auth";

export const metadata: Metadata = { title: "Edit quotation", robots: { index: false } };

const ymd = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

export default async function EditQuotationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const staff = await getStaff();
  if (!staff || !roleCan(staff.role, "quotes.write")) redirect("/erp/quotations");

  const [quotation, catalog, organizations] = await Promise.all([
    db.quotation.findUnique({
      where: { id },
      include: { items: { orderBy: { sortOrder: "asc" } } },
    }),
    catalogForQuoting(),
    organizationsForBilling(),
  ]);
  if (!quotation) notFound();
  // Once it has gone out, the figures a school is holding must not change
  if (!["DRAFT", "PENDING_APPROVAL", "APPROVED"].includes(quotation.status)) {
    redirect(`/erp/quotations/${id}`);
  }

  const validDays = Math.max(
    1,
    Math.round((quotation.validUntil.getTime() - quotation.quotedOn.getTime()) / 86400000),
  );
  const approver = roleCan(staff.role, "invoices.approve");

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <div>
        <Link
          href={`/erp/quotations/${id}`}
          className="mb-1 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="size-4" /> Back to the quotation
        </Link>
        <h1 className="font-heading text-2xl font-bold">Edit {quotation.number}</h1>
        <p className="text-sm text-muted-foreground">
          {approver
            ? "It has not gone to the school yet, so it can still change."
            : "Saving sends it to your manager to approve again, so a figure never changes unseen."}
        </p>
      </div>
      {quotation.rejectedReason && (
        <p className="rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          Sent back by the manager: {quotation.rejectedReason}
        </p>
      )}
      <QuotationForm
        catalog={catalog}
        organizations={organizations}
        initial={{
          id: quotation.id,
          organizationId: quotation.organizationId ?? organizations[0]?.id ?? "",
          contactPerson: quotation.contactPerson ?? "",
          shipElsewhere: Boolean(quotation.shipToName || quotation.shipToAddress),
          shipToName: quotation.shipToName ?? "",
          shipToAddress: quotation.shipToAddress ?? "",
          placeOfSupply: quotation.placeOfSupply,
          quotedOn: ymd(quotation.quotedOn),
          validDays: String(validDays),
          billDiscountBp: String(quotation.billDiscountBp),
          terms: quotation.terms ?? "",
          notes: quotation.notes ?? "",
          lines: quotation.items.map((i) => ({
            productId: i.productId,
            description: i.description,
            contents: i.contents ?? "",
            hsnCode: i.hsnCode ?? "",
            unit: i.unit.toUpperCase(),
            quantity: String(i.quantity),
            mrp: i.mrp ? String(i.mrp / 100) : "",
            unitPrice: String(i.unitPrice / 100),
            discount:
              i.discountAmount > 0
                ? String(i.discountAmount / 100)
                : i.discountBp > 0
                  ? String(i.discountBp / 100)
                  : "",
            discountMode: i.discountAmount > 0 || i.discountBp === 0 ? "amount" : "percent",
            gstRate: String(i.gstRate),
          })),
        }}
      />
    </div>
  );
}
