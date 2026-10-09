export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";

import { OrganizationForm } from "@/components/erp/organization-form";
import { salesPeople } from "@/app/erp/(panel)/organizations/new/page";
import { db } from "@/lib/db";
import { getStaff, roleCan } from "@/lib/staff-auth";

export const metadata: Metadata = { title: "Edit organisation", robots: { index: false } };

export default async function EditOrganizationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const staff = await getStaff();
  if (!staff || !roleCan(staff.role, "crm.manage")) redirect(`/erp/organizations/${id}`);

  const [org, people] = await Promise.all([
    db.organization.findUnique({ where: { id } }),
    salesPeople(),
  ]);
  if (!org) notFound();

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div>
        <Link
          href={`/erp/organizations/${id}`}
          className="mb-1 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="size-4" /> Back
        </Link>
        <h1 className="font-heading text-2xl font-bold">Edit {org.name}</h1>
      </div>
      <OrganizationForm
        people={people}
        initial={{
          id: org.id,
          name: org.name,
          code: org.code,
          kind: org.kind,
          contactPerson: org.contactPerson ?? "",
          designation: org.designation ?? "",
          phone: org.phone ?? "",
          email: org.email ?? "",
          addressLine: org.addressLine ?? "",
          city: org.city ?? "",
          state: org.state ?? "",
          pincode: org.pincode ?? "",
          gstin: org.gstin ?? "",
          strength: org.strength,
          board: org.board ?? "",
          ownerId: org.ownerId ?? "",
          source: org.source ?? "",
          referredBy: org.referredBy ?? "",
          status: org.status,
          notes: org.notes ?? "",
        }}
      />
    </div>
  );
}
