export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";

import { InvoiceForm, type OrgOption } from "@/components/erp/invoice-form";
import { catalogForQuoting } from "@/app/erp/(panel)/quotations/new/page";
import { db } from "@/lib/db";
import { OUR_STATE } from "@/lib/quotation-math";
import { getStaff, roleCan } from "@/lib/staff-auth";

export const metadata: Metadata = { title: "New invoice", robots: { index: false } };

export async function organizationsForBilling(): Promise<OrgOption[]> {
  const rows = await db.organization.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true, code: true, state: true },
  });
  return rows.map((o) => ({
    id: o.id,
    name: o.name,
    code: o.code,
    placeOfSupply: o.state || OUR_STATE,
  }));
}

export default async function NewInvoicePage() {
  const staff = await getStaff();
  if (!staff || !roleCan(staff.role, "invoices.write")) redirect("/erp/invoices");

  const [catalog, organizations] = await Promise.all([
    catalogForQuoting(),
    organizationsForBilling(),
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
      <InvoiceForm catalog={catalog} organizations={organizations} />
    </div>
  );
}
