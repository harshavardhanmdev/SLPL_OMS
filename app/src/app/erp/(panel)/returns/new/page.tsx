export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";

import { ReturnForm } from "@/components/erp/return-form";
import { db } from "@/lib/db";
import { formatINR } from "@/lib/money";
import { getStaff, roleCan } from "@/lib/staff-auth";

export const metadata: Metadata = { title: "Record a return", robots: { index: false } };

export default async function NewReturnPage() {
  const staff = await getStaff();
  if (!staff || !roleCan(staff.role, "finance.write")) redirect("/erp/returns");

  const [organizations, invoices] = await Promise.all([
    db.organization.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    db.invoice.findMany({
      where: { organizationId: { not: null }, status: { in: ["APPROVED", "SENT", "PAID"] } },
      orderBy: { invoiceDate: "desc" },
      take: 500,
      select: { id: true, organizationId: true, number: true, total: true },
    }),
  ]);

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div>
        <Link
          href="/erp/returns"
          className="mb-1 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="size-4" /> Back to returns
        </Link>
        <h1 className="font-heading text-2xl font-bold">Record a return</h1>
        <p className="text-sm text-muted-foreground">Goods a school sent back, at the rate they were sold.</p>
      </div>
      <ReturnForm
        organizations={organizations}
        invoices={invoices.map((i) => ({
          id: i.id,
          organizationId: i.organizationId!,
          label: `${i.number}, ${formatINR(i.total)}`,
        }))}
      />
    </div>
  );
}
