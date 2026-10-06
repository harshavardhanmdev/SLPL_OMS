export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";

import { QuotationForm, type CatalogItem } from "@/components/erp/quotation-form";
import { db } from "@/lib/db";
import { getStaff, roleCan } from "@/lib/staff-auth";

export const metadata: Metadata = { title: "New quotation", robots: { index: false } };

/** Everything sellable, books and services alike, priced as the catalogue has it. */
export async function catalogForQuoting(): Promise<CatalogItem[]> {
  const [products, services] = await Promise.all([
    db.product.findMany({
      where: { isActive: true },
      orderBy: [{ series: "asc" }, { title: "asc" }],
      select: { id: true, title: true, hsnCode: true, gstRate: true, price: true, salePrice: true, unit: true },
    }),
    db.servicePage.findMany({
      where: { isVisible: true },
      orderBy: { sortOrder: "asc" },
      select: { id: true, title: true },
    }),
  ]);

  return [
    ...products.map((p) => ({
      id: p.id,
      title: p.title,
      hsnCode: p.hsnCode,
      gstRate: p.gstRate,
      price: p.salePrice ?? p.price,
      unit: p.unit === "SET" ? "Set" : "Nos",
    })),
    // Services carry SAC 9992 at 18% and are priced per quotation, so no rate
    ...services.map((s) => ({
      id: `service:${s.id}`,
      title: s.title,
      hsnCode: "9992",
      gstRate: 1800,
      price: 0,
      unit: "Nos",
    })),
  ];
}

export default async function NewQuotationPage() {
  const staff = await getStaff();
  if (!staff || !roleCan(staff.role, "quotes.write")) redirect("/erp/quotations");

  const catalog = await catalogForQuoting();

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <div>
        <Link
          href="/erp/quotations"
          className="mb-1 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="size-4" /> Back to quotations
        </Link>
        <h1 className="font-heading text-2xl font-bold">New quotation</h1>
        <p className="text-sm text-muted-foreground">
          Pick titles from the catalogue or type a service. GST is worked out per line, and the
          place of supply decides whether it splits into CGST and SGST or stays as IGST.
        </p>
      </div>
      <QuotationForm catalog={catalog} />
    </div>
  );
}
