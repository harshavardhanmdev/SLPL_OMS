export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";

import { VendorForm } from "@/components/erp/vendor-controls";
import { getStaff, roleCan } from "@/lib/staff-auth";

export const metadata: Metadata = { title: "Add a vendor", robots: { index: false } };

export default async function NewVendorPage() {
  const staff = await getStaff();
  if (!staff || !roleCan(staff.role, "staff.manage")) redirect("/erp");
  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div>
        <Link
          href="/erp/vendors"
          className="mb-1 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="size-4" /> Back to vendors
        </Link>
        <h1 className="font-heading text-2xl font-bold">Add a vendor</h1>
        <p className="text-sm text-muted-foreground">
          A printer, a paper supplier, the landlord, the electricity board: anyone we pay.
        </p>
      </div>
      <VendorForm />
    </div>
  );
}
