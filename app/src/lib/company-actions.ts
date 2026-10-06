"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { audit } from "@/lib/audit";
import { db } from "@/lib/db";
import { requireCapability } from "@/lib/staff-auth";

/**
 * The company profile that every printed document reads.
 *
 * Stored as Settings so a bank account or a GSTIN changing never needs a
 * deploy. Gated on staff.manage, because these values appear on documents that
 * go to schools, banks and the GST portal.
 */

type Result = { ok?: boolean; error?: string };

const schema = z.object({
  company_tagline: z.string().trim().max(120),
  company_address: z.string().trim().max(300),
  contact_phone: z.string().trim().max(40),
  company_alt_phone: z.string().trim().max(40),
  contact_email: z.string().trim().max(120),
  company_gstin: z.string().trim().max(20),
  company_pan: z.string().trim().max(12),
  company_cin: z.string().trim().max(30),
  bank_name: z.string().trim().max(120),
  bank_account_no: z.string().trim().max(30),
  bank_ifsc: z.string().trim().max(20),
  bank_branch: z.string().trim().max(120),
  upi_id: z.string().trim().max(80),
  signature_image: z.string().trim().max(200),
});

export type CompanyInput = z.infer<typeof schema>;

export async function saveCompanyProfile(input: CompanyInput): Promise<Result> {
  const denied = await requireCapability("staff.manage");
  if (denied) {
    return { error: denied === "FORBIDDEN" ? "Only an owner can change this." : "Sign in again." };
  }

  const parsed = schema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const before = await db.setting.findMany({
    where: { key: { in: Object.keys(parsed.data) } },
  });

  for (const [key, value] of Object.entries(parsed.data)) {
    await db.setting.upsert({
      where: { key },
      update: { value: value as unknown as object },
      create: { key, value: value as unknown as object },
    });
  }

  await audit({
    action: "company.profile",
    entityType: "Setting",
    before: Object.fromEntries(before.map((b) => [b.key, b.value])),
    after: parsed.data,
  });

  revalidatePath("/erp/company");
  return { ok: true };
}
