export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";

import { ChallanForm, type ChallanDraft } from "@/components/erp/challan-form";
import { getCompany } from "@/lib/company";
import { db } from "@/lib/db";
import { getStaff, roleCan } from "@/lib/staff-auth";

export const metadata: Metadata = { title: "Raise a challan", robots: { index: false } };

type AddressParts = {
  addressLine: string | null;
  city: string | null;
  state: string | null;
  pincode: string | null;
  contactPerson: string | null;
  phone: string | null;
};

/** One address block, with a name and number the driver can ring on arrival. */
function addressBlock(a: AddressParts): string {
  const place = [a.city, a.state].filter(Boolean).join(", ");
  const contact = [a.contactPerson, a.phone].filter(Boolean).join(", ");
  return [
    a.addressLine,
    place || a.pincode ? `${place}${a.pincode ? ` - ${a.pincode}` : ""}` : null,
    contact ? `Contact: ${contact}` : null,
  ]
    .filter(Boolean)
    .join("\n");
}

export default async function NewChallanPage({
  searchParams,
}: {
  searchParams: Promise<{ invoiceId?: string; org?: string }>;
}) {
  const staff = await getStaff();
  if (!staff || !roleCan(staff.role, "challan.write")) redirect("/erp/challans");
  const { invoiceId, org } = await searchParams;

  const [company, orgs, invoice] = await Promise.all([
    getCompany(),
    db.organization.findMany({
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        addressLine: true,
        city: true,
        state: true,
        pincode: true,
        contactPerson: true,
        phone: true,
      },
    }),
    invoiceId
      ? db.invoice.findUnique({
          where: { id: invoiceId },
          include: { items: { orderBy: { sortOrder: "asc" } } },
        })
      : null,
  ]);

  const organizations = orgs.map((o) => ({ id: o.id, name: o.name, address: addressBlock(o) }));

  const picked = !invoice && org ? organizations.find((o) => o.id === org) : undefined;

  const draft: ChallanDraft = invoice
    ? {
        // From the bill's own snapshot, so the challan matches what was billed
        organizationId: invoice.organizationId ?? "",
        invoiceId: invoice.id,
        invoiceNumber: invoice.number,
        fromAddress: company.address,
        toName: invoice.customerName,
        toAddress: addressBlock(invoice),
        lines: invoice.items.map((i) => ({
          description: i.description,
          unit: i.unit,
          quantity: String(i.quantity),
        })),
      }
    : {
        organizationId: picked?.id ?? "",
        invoiceId: "",
        invoiceNumber: "",
        fromAddress: company.address,
        toName: picked?.name ?? "",
        toAddress: picked?.address ?? "",
        lines: [],
      };

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div>
        <Link
          href="/erp/challans"
          className="mb-1 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="size-4" /> Back to challans
        </Link>
        <h1 className="font-heading text-2xl font-bold">Raise a delivery challan</h1>
        <p className="text-sm text-muted-foreground">
          It prints on our letterhead and goes with the goods. It is not an e-way bill.
        </p>
      </div>
      <ChallanForm organizations={organizations} draft={draft} />
    </div>
  );
}
