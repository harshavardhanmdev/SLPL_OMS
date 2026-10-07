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
 * Cambridge Schools -> CAM. Another school starting the same way keeps the
 * letters and takes the next number, CAM2, CAM3, so schools with the same
 * name never share a code and nobody adding one has to think about numbering.
 */
export async function suggestCode(name: string, ignoreId?: string): Promise<string> {
  const letters = name.toUpperCase().replace(/[^A-Z]/g, "");
  const base = (letters.slice(0, 3) || "ORG").padEnd(3, "X");
  for (let i = 1; i < 1000; i++) {
    const candidate = i === 1 ? base : `${base}${i}`;
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

const importRowSchema = z.object({
  name: z.string().trim().min(2, "No school name").max(120),
  contactPerson: z.string().trim().max(80).optional(),
  phone: z.string().trim().max(20).optional(),
  email: z.string().trim().max(120).optional(),
  addressLine: z.string().trim().max(200).optional(),
  city: z.string().trim().max(60).optional(),
  state: z.string().trim().max(60).optional(),
  pincode: z.string().trim().max(10).optional(),
  gstin: z.string().trim().max(20).optional(),
});

export type ImportRow = z.infer<typeof importRowSchema>;

export type ImportResult = {
  error?: string;
  created?: number;
  skipped?: { name: string; reason: string }[];
};

/** Same school if the name matches and the city does too, or one of them has no city. */
const nameKey = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

/**
 * A salesperson's list of schools from a spreadsheet. Each new school comes in
 * as a lead, not yet active, until a quotation or an invoice is raised for it.
 * A school already on record is skipped, never duplicated.
 */
export async function importOrganizations(input: { rows: ImportRow[]; ownerId?: string | null }): Promise<ImportResult> {
  const denied = await requireCapability("crm.write");
  if (denied) return { error: DENIED[denied] };
  const staff = await getStaff();
  if (!staff) return { error: DENIED.UNAUTHORIZED };
  if (!Array.isArray(input.rows) || input.rows.length === 0) return { error: "The sheet has no schools in it." };
  if (input.rows.length > 2000) return { error: "That is over 2,000 rows. Split the sheet and import it in parts." };

  // A manager can hand the list to a salesperson; a salesperson's list is theirs
  const manager = (await requireCapability("crm.manage")) === null;
  let ownerId: string | null = staff.breakGlass ? null : staff.id;
  if (manager) {
    ownerId = input.ownerId || null;
    if (ownerId && !(await db.adminUser.findUnique({ where: { id: ownerId }, select: { id: true } }))) {
      return { error: "Pick who looks after these schools again." };
    }
  }

  const known = (await db.organization.findMany({ select: { name: true, city: true } })).map((o) => ({
    name: nameKey(o.name),
    city: nameKey(o.city ?? ""),
  }));
  const seen = (name: string, city: string) =>
    known.some((k) => k.name === name && (k.city === city || !k.city || !city));

  const skipped: { name: string; reason: string }[] = [];
  let created = 0;
  for (const raw of input.rows) {
    const parsed = importRowSchema.safeParse(raw);
    if (!parsed.success) {
      skipped.push({ name: String(raw?.name ?? "").slice(0, 120) || "(blank)", reason: parsed.error.issues[0].message });
      continue;
    }
    const r = parsed.data;
    const key = { name: nameKey(r.name), city: nameKey(r.city ?? "") };
    if (seen(key.name, key.city)) {
      skipped.push({ name: r.name, reason: "Already on record" });
      continue;
    }
    await db.organization.create({
      data: {
        code: await suggestCode(r.name),
        name: r.name,
        kind: "SCHOOL",
        contactPerson: r.contactPerson || null,
        phone: r.phone || null,
        email: r.email || null,
        addressLine: r.addressLine || null,
        city: r.city || null,
        ...(r.state ? { state: r.state } : {}),
        pincode: r.pincode || null,
        gstin: r.gstin ? r.gstin.toUpperCase() : null,
        ownerId,
        source: "Excel import",
        status: "LEAD",
      },
    });
    known.push(key);
    created++;
  }

  await audit({
    action: "organization.import",
    entityType: "Organization",
    after: { created, skipped: skipped.length, ownerId },
  });
  revalidatePath("/erp/organizations");
  return { created, skipped };
}
