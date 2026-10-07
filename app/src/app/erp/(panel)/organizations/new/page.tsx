export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";

import { OrganizationForm } from "@/components/erp/organization-form";
import { db } from "@/lib/db";
import { getStaff, roleCan } from "@/lib/staff-auth";

export const metadata: Metadata = { title: "Add an organisation", robots: { index: false } };

/** Everyone who could be made responsible for a school. */
export async function salesPeople() {
  return db.adminUser.findMany({
    where: { isActive: true, role: { in: ["SALES", "SALES_MANAGER", "MANAGER", "OWNER"] } },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });
}

export default async function NewOrganizationPage() {
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
        <h1 className="font-heading text-2xl font-bold">Add an organisation</h1>
        <p className="text-sm text-muted-foreground">
          Search the list first. One school must never end up with two records.
        </p>
      </div>
      {/* A salesperson's new school is theirs to look after */}
      <OrganizationForm people={canManage ? await salesPeople() : [{ id: staff.id, name: staff.name }]} />
    </div>
  );
}
