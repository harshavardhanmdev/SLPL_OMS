export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { CompanyForm } from "@/components/erp/company-form";
import { getSetting } from "@/lib/catalog";
import { site } from "@/lib/site";
import { getStaff, roleCan } from "@/lib/staff-auth";

export const metadata: Metadata = { title: "Company profile", robots: { index: false } };

export default async function CompanyPage() {
  const staff = await getStaff();
  if (!staff || !roleCan(staff.role, "staff.manage")) redirect("/erp");

  const keys = [
    ["company_tagline", "BRINGING A CHANGE YOU WISH FOR"],
    ["company_address", site.contact.address],
    ["contact_phone", site.contact.phone],
    ["company_alt_phone", ""],
    ["contact_email", site.contact.email],
    ["company_gstin", ""],
    ["company_pan", ""],
    ["company_cin", ""],
    ["bank_name", ""],
    ["bank_account_no", ""],
    ["bank_ifsc", ""],
    ["bank_branch", ""],
    ["upi_id", ""],
    ["signature_image", ""],
  ] as const;

  const values = Object.fromEntries(
    await Promise.all(keys.map(async ([k, d]) => [k, await getSetting<string>(k, d)])),
  ) as Record<(typeof keys)[number][0], string>;

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div>
        <h1 className="font-heading text-2xl font-bold">Company profile</h1>
        <p className="text-sm text-muted-foreground">
          What appears on every quotation, invoice and challan. Changing it here changes the next
          document printed, with no deploy.
        </p>
      </div>
      <CompanyForm initial={values} />
    </div>
  );
}
