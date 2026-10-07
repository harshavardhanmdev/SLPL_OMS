export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";

import { OrganizationImport } from "@/components/erp/organization-import";
import { getStaff, roleCan } from "@/lib/staff-auth";
import { salesPeople } from "../new/page";

export const metadata: Metadata = { title: "Import schools", robots: { index: false } };

export default async function ImportOrganizationsPage() {
  const staff = await getStaff();
  if (!staff || !roleCan(staff.role, "crm.write")) redirect("/erp/organizations");
  const canManage = roleCan(staff.role, "crm.manage");

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div>
        <Link
          href="/erp/organizations"
          className="mb-1 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="size-4" /> Back to organisations
        </Link>
        <h1 className="font-heading text-2xl font-bold">Import schools from Excel</h1>
        <p className="text-sm text-muted-foreground">
          {canManage
            ? "Add a salesperson's list of schools in one go."
            : "Add your list of schools in one go. They will be yours to look after."}
        </p>
      </div>
      <OrganizationImport people={canManage ? await salesPeople() : []} canPickOwner={canManage} />
    </div>
  );
}
