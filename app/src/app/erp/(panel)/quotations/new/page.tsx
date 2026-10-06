export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Building2, ChevronLeft } from "lucide-react";

import { Button } from "@/components/ui/button";
import { QuotationForm } from "@/components/erp/quotation-form";
import { catalogForQuoting, organizationsForBilling } from "@/lib/quoting";
import { getStaff, roleCan } from "@/lib/staff-auth";

export const metadata: Metadata = { title: "New quotation", robots: { index: false } };

export default async function NewQuotationPage({
  searchParams,
}: {
  searchParams: Promise<{ org?: string }>;
}) {
  const staff = await getStaff();
  if (!staff || !roleCan(staff.role, "quotes.write")) redirect("/erp/quotations");

  const { org } = await searchParams;
  const [catalog, organizations] = await Promise.all([catalogForQuoting(), organizationsForBilling()]);

  if (organizations.length === 0) {
    return (
      <div className="mx-auto max-w-lg rounded-2xl border bg-card p-8 text-center">
        <Building2 className="mx-auto size-8 text-muted-foreground" />
        <p className="mt-3 font-medium">Add the school first.</p>
        <p className="mt-1 text-sm text-muted-foreground">
          A quotation is kept on the school&apos;s record, so its history is in one place.
        </p>
        <Button className="mt-4" asChild>
          <Link href="/erp/organizations/new">Add a school</Link>
        </Button>
      </div>
    );
  }

  const chosen = organizations.find((o) => o.id === org);
  const approver = roleCan(staff.role, "invoices.approve");

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
          Pick from the school price list or type a line. GST is worked out per line, and the
          place of supply decides CGST and SGST or IGST.
          {approver ? "" : " Your manager approves it before it can go to the school."}
        </p>
      </div>
      <QuotationForm
        catalog={catalog}
        organizations={chosen ? [chosen, ...organizations.filter((o) => o !== chosen)] : organizations}
      />
    </div>
  );
}
