"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { audit } from "@/lib/audit";
import { db } from "@/lib/db";
import { getStaff, requireCapability } from "@/lib/staff-auth";

/**
 * The customer master.
 *
 * One school, one record. The owner was explicit that a new enquiry must never
 * create a second, so the screens search before they offer to add, and the code
 * is unique by construction.
 */

type Result = { ok?: boolean; error?: string; id?: string; code?: string };

const DENIED: Record<string, string> = {
  UNAUTHORIZED: "Sign in again.",
  FORBIDDEN: "Only a sales manager or an owner can change organisations.",
};

/**
 * Three letters from the name, which become part of every invoice number.
 * Cambridge Schools -> CAM. A clash gets a digit rather than failing, because
 * somebody adding a school should not have to think about numbering.
 */
export async function suggestCode(name: string, ignoreId?: string): Promise<string> {
  const letters = name.toUpperCase().replace(/[^A-Z]/g, "");
  const base = (letters.slice(0, 3) || "ORG").padEnd(3, "X");
  for (let i = 0; i < 100; i++) {
    const candidate = i === 0 ? base : `${base.slice(0, 2)}${i}`;
    const clash = await db.organization.findFirst({
      where: { code: candidate, ...(ignoreId ? { NOT: { id: ignoreId } } : {}) },
      select: { id: true },
    });
    if (!clash) return candidate;
  }
  throw new Error("Could not allocate a customer code - set one by hand.");
}

const schema = z.object({
  id: z.string().optional(),
  name: z.string().trim().min(2, "Enter the organisation name").max(120),
  code: z.string().trim().max(6).optional().or(z.literal("")),
  kind: z.enum(["SCHOOL", "COLLEGE", "DISTRIBUTOR", "INSTITUTION", "INDIVIDUAL"]),
  contactPerson: z.string().trim().max(80).optional().or(z.literal("")),
  designation: z.string().trim().max(60).optional().or(z.literal("")),
  phone: z.string().trim().max(20).optional().or(z.literal("")),
  email: z.string().trim().max(120).optional().or(z.literal("")),
  addressLine: z.string().trim().max(200).optional().or(z.literal("")),
  city: z.string().trim().max(60).optional().or(z.literal("")),
  state: z.string().trim().max(60).optional().or(z.literal("")),
  pincode: z.string().trim().max(10).optional().or(z.literal("")),
  gstin: z.string().trim().max(20).optional().or(z.literal("")),
  ownerId: z.string().optional().nullable(),
  source: z.string().trim().max(60).optional().or(z.literal("")),
  status: z.enum(["LEAD", "ACTIVE", "DORMANT", "LOST"]),
  notes: z.string().trim().max(2000).optional().or(z.literal("")),
});

export type OrganizationInput = z.infer<typeof schema>;

export async function saveOrganization(input: OrganizationInput): Promise<Result> {
  // Anyone in sales adds a school they have found; changing one stays with a
  // manager, since its code is already in that school's invoice numbers
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const d = parsed.data;
  const denied = await requireCapability(d.id ? "crm.manage" : "crm.write");
  if (denied) return { error: DENIED[denied] };
  const manager = (await requireCapability("crm.manage")) === null;
  // A salesperson who adds a school looks after it
  if (!manager) d.ownerId = (await getStaff())?.id ?? null;

  const code = (d.code || "").toUpperCase() || (await suggestCode(d.name, d.id));
  const clash = await db.organization.findFirst({
    where: { code, ...(d.id ? { NOT: { id: d.id } } : {}) },
    select: { name: true },
  });
  if (clash) return { error: `${code} is already used by ${clash.name}. Pick another code.` };

  const data = {
    name: d.name,
    code,
    kind: d.kind,
    contactPerson: d.contactPerson || null,
    designation: d.designation || null,
    phone: d.phone || null,
    email: d.email || null,
    addressLine: d.addressLine || null,
    city: d.city || null,
    state: d.state || null,
    pincode: d.pincode || null,
    gstin: d.gstin || null,
    ownerId: d.ownerId || null,
    source: d.source || null,
    status: d.status,
    notes: d.notes || null,
  };

  const before = d.id ? await db.organization.findUnique({ where: { id: d.id } }) : null;
  const row = d.id
    ? await db.organization.update({ where: { id: d.id }, data })
    : await db.organization.create({ data });

  await audit({
    action: d.id ? "organization.update" : "organization.create",
    entityType: "Organization",
    entityId: row.id,
    before,
    after: row,
  });
  revalidatePath("/erp/organizations");
  return { ok: true, id: row.id, code: row.code };
}

/**
 * Deleting is refused once anything financial hangs off the record, because an
 * invoice without a customer is worse than a dormant row nobody looks at.
 */
export async function deleteOrganization(id: string): Promise<Result> {
  const denied = await requireCapability("crm.manage");
  if (denied) return { error: DENIED[denied] };

  const org = await db.organization.findUnique({
    where: { id },
    include: { _count: { select: { invoices: true, receipts: true, quotations: true } } },
  });
  if (!org) return { error: "That organisation no longer exists." };

  const { invoices, receipts, quotations } = org._count;
  if (invoices || receipts || quotations) {
    return {
      error:
        `${org.name} has ${invoices} invoice(s), ${quotations} quotation(s) and ` +
        `${receipts} receipt(s) against it. Mark it Lost or Dormant instead of deleting.`,
    };
  }

  await db.organization.delete({ where: { id } });
  await audit({
    action: "organization.delete",
    entityType: "Organization",
    entityId: id,
    before: org,
  });
  revalidatePath("/erp/organizations");
  return { ok: true };
}
