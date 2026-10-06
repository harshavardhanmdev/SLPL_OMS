export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";

import { QuotationForm } from "@/components/erp/quotation-form";
import { catalogForQuoting } from "@/app/erp/(panel)/quotations/new/page";
import { db } from "@/lib/db";
import { getStaff, roleCan } from "@/lib/staff-auth";

export const metadata: Metadata = { title: "Edit quotation", robots: { index: false } };

export default async function EditQuotationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const staff = await getStaff();
  if (!staff || !roleCan(staff.role, "quotes.write")) redirect("/erp/quotations");

  const [quotation, catalog] = await Promise.all([
    db.quotation.findUnique({
      where: { id },
      include: { items: { orderBy: { sortOrder: "asc" } } },
    }),
    catalogForQuoting(),
  ]);
  if (!quotation) notFound();
  // Once it has gone out, the figures a school is holding must not change
  if (quotation.status !== "DRAFT") redirect(`/erp/quotations/${id}`);

  const daysLeft = Math.max(
    1,
    Math.round((quotation.validUntil.getTime() - quotation.quotedOn.getTime()) / 86400000),
  );

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
          Still a draft, so it can be changed. Once it is marked as sent it is fixed, and a change
          of price means a fresh quotation.
        </p>
      </div>
      <QuotationForm
        catalog={catalog}
        initial={{
          id: quotation.id,
          customerName: quotation.customerName,
          contactPerson: quotation.contactPerson ?? "",
          phone: quotation.phone ?? "",
          email: quotation.email ?? "",
          addressLine: quotation.addressLine ?? "",
          city: quotation.city ?? "",
          state: quotation.state ?? "",
          pincode: quotation.pincode ?? "",
          gstin: quotation.gstin ?? "",
          placeOfSupply: quotation.placeOfSupply,
          validDays: String(daysLeft),
          terms: quotation.terms ?? "",
          notes: quotation.notes ?? "",
          lines: quotation.items.map((i) => ({
            productId: i.productId,
            description: i.description,
            hsnCode: i.hsnCode ?? "",
            unit: i.unit,
            quantity: String(i.quantity),
            unitPrice: (i.unitPrice / 100).toString(),
            discountBp: String(i.discountBp),
            gstRate: String(i.gstRate),
          })),
        }}
      />
    </div>
  );
}
