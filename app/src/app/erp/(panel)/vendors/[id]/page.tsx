export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";

import { VendorForm, VendorPayForm } from "@/components/erp/vendor-controls";
import { db } from "@/lib/db";
import { categoryLabel, financialYearOf, paidFromLabel } from "@/lib/expense-constants";
import { formatINR } from "@/lib/money";
import { getStaff, roleCan } from "@/lib/staff-auth";

export const metadata: Metadata = { title: "Vendor", robots: { index: false } };

const dateIN = (d: Date) =>
  d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });

/** One vendor: who they are, paying them, and every payment made. */
export default async function VendorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const staff = await getStaff();
  if (!staff || !roleCan(staff.role, "staff.manage")) redirect("/erp");

  const vendor = await db.vendor.findUnique({
    where: { id },
    include: { expenses: { orderBy: [{ spentAt: "desc" }, { createdAt: "desc" }], take: 200 } },
  });
  if (!vendor) notFound();

  const fy = financialYearOf(new Date());
  const paid = vendor.expenses.filter((e) => e.amount > 0);
  const thisYear = paid
    .filter((e) => e.spentAt >= fy.start && e.spentAt <= fy.end)
    .reduce((s, e) => s + e.amount, 0);
  const allTime = paid.reduce((s, e) => s + e.amount, 0);

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div>
        <Link
          href="/erp/vendors"
          className="mb-1 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="size-4" /> Back to vendors
        </Link>
        <h1 className="font-heading text-2xl font-bold">{vendor.name}</h1>
        <p className="text-sm text-muted-foreground">
          {categoryLabel(vendor.category)}
          {vendor.recurringDay
            ? ` · every month on the ${vendor.recurringDay}${
                vendor.recurringAmount ? `, ${formatINR(vendor.recurringAmount)}` : ", amount varies"
              }`
            : ""}
        </p>
        <p className="text-xs text-muted-foreground">
          {[
            vendor.contactPerson,
            vendor.phone,
            vendor.email,
            vendor.gstin && `GSTIN ${vendor.gstin}`,
            vendor.payTo && `Pay to ${vendor.payTo}`,
          ]
            .filter(Boolean)
            .join(" · ")}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-2xl border bg-card p-4">
          <p className="text-xs text-muted-foreground">Paid in {fy.label}</p>
          <p className="font-heading text-xl font-bold">{formatINR(thisYear)}</p>
        </div>
        <div className="rounded-2xl border bg-card p-4">
          <p className="text-xs text-muted-foreground">Paid in all</p>
          <p className="font-heading text-xl font-bold">{formatINR(allTime)}</p>
        </div>
      </div>

      {vendor.isActive && (
        <VendorPayForm
          vendor={{
            id: vendor.id,
            name: vendor.name,
            category: vendor.category,
            gstin: vendor.gstin,
            recurringAmount: vendor.recurringAmount,
          }}
        />
      )}

      <section className="rounded-2xl border bg-card">
        <div className="border-b p-4">
          <h2 className="font-heading font-semibold">Payments</h2>
          <p className="text-sm text-muted-foreground">
            Each one is also in Expenses, under its voucher number.
          </p>
        </div>
        {vendor.expenses.length === 0 ? (
          <p className="p-6 text-center text-sm text-muted-foreground">Nothing paid yet.</p>
        ) : (
          <ul className="divide-y">
            {vendor.expenses.map((e) => (
              <li key={e.id} className="flex flex-wrap items-start justify-between gap-2 p-4">
                <div className="min-w-0">
                  <p className="font-medium">{dateIN(e.spentAt)}</p>
                  <p className="text-sm text-muted-foreground">
                    {paidFromLabel(e.paidFrom)}
                    {e.reference ? ` · ${e.reference}` : ""}
                    {e.note ? ` · ${e.note}` : ""}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {e.voucherNo}
                    {e.billImage && (
                      <>
                        {" · "}
                        <a href={e.billImage} target="_blank" rel="noreferrer" className="underline">
                          Bill photo
                        </a>
                      </>
                    )}
                  </p>
                </div>
                <span
                  className={`font-semibold tabular-nums ${e.amount === 0 ? "text-muted-foreground line-through" : ""}`}
                >
                  {e.amount === 0 ? "voided" : formatINR(e.amount)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <details className="rounded-2xl border bg-card p-4">
        <summary className="cursor-pointer font-heading font-semibold">Edit {vendor.name}</summary>
        <div className="mt-4">
          <VendorForm
            initial={{
              id: vendor.id,
              name: vendor.name,
              category: vendor.category,
              contactPerson: vendor.contactPerson ?? "",
              phone: vendor.phone ?? "",
              email: vendor.email ?? "",
              gstin: vendor.gstin ?? "",
              payTo: vendor.payTo ?? "",
              notes: vendor.notes ?? "",
              recurringDay: vendor.recurringDay ? String(vendor.recurringDay) : "",
              recurringAmount: vendor.recurringAmount ? String(vendor.recurringAmount / 100) : "",
              isActive: vendor.isActive,
            }}
          />
        </div>
      </details>
    </div>
  );
}
