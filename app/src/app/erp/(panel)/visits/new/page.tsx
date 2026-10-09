export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";

import { VisitForm } from "@/components/erp/visit-form";
import { db } from "@/lib/db";
import { SCHOOLS_ONLY } from "@/lib/money-scope";
import { getStaff, roleCan } from "@/lib/staff-auth";

export const metadata: Metadata = { title: "Log a visit", robots: { index: false } };

export default async function NewVisitPage({
  searchParams,
}: {
  searchParams: Promise<{ org?: string }>;
}) {
  const staff = await getStaff();
  if (!staff || !roleCan(staff.role, "crm.write")) redirect("/erp");
  const { org } = await searchParams;

  const organizations = await db.organization.findMany({
    where: SCHOOLS_ONLY,
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });

  if (organizations.length === 0) {
    return (
      <div className="mx-auto max-w-lg rounded-2xl border bg-card p-8 text-center">
        <p className="font-medium">No schools on the books yet.</p>
        <p className="mt-1 text-sm text-muted-foreground">
          A visit has to be against an organisation. Ask your manager to add one.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <div>
        <Link
          href="/erp/sales"
          className="mb-1 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="size-4" /> Back to sales
        </Link>
        <h1 className="font-heading text-2xl font-bold">Log a visit</h1>
      </div>
      <VisitForm organizations={organizations} defaultOrgId={org} />
    </div>
  );
}
