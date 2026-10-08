"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { audit } from "@/lib/audit";
import { db } from "@/lib/db";
import { isExpenseCategory } from "@/lib/expense-constants";
import { requireCapability } from "@/lib/staff-auth";

/**
 * The people we pay. Only an owner keeps this list, as it is the company's
 * suppliers and what they cost. A payment to one is an ordinary expense with
 * the vendor attached, recorded through saveExpense.
 */

type Result = { ok?: boolean; error?: string; id?: string };

const schema = z.object({
  id: z.string().optional(),
  name: z.string().trim().min(2, "Enter the vendor's name").max(120),
  category: z.string().min(1, "Pick what their payments are for"),
  contactPerson: z.string().trim().max(80).optional().or(z.literal("")),
  phone: z.string().trim().max(20).optional().or(z.literal("")),
  email: z.string().trim().max(120).optional().or(z.literal("")),
  gstin: z.string().trim().max(20).optional().or(z.literal("")),
  payTo: z.string().trim().max(200).optional().or(z.literal("")),
  notes: z.string().trim().max(1000).optional().or(z.literal("")),
  /** Day of the month a recurring payment falls due, or nothing. */
  recurringDay: z
    .number()
    .int()
    .min(1, "Pick a day from 1 to 28")
    .max(28, "Pick a day from 1 to 28")
    .nullable(),
  /** Rupees as typed, or nothing when it varies. */
  recurringAmount: z.number().min(0).max(100_000_000).nullable(),
  isActive: z.boolean(),
});

export type VendorInput = z.infer<typeof schema>;

export async function saveVendor(input: VendorInput): Promise<Result> {
  const denied = await requireCapability("staff.manage");
  if (denied)
    return { error: denied === "FORBIDDEN" ? "Only an owner keeps the vendor list." : "Sign in again." };

  const parsed = schema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const d = parsed.data;
  if (!isExpenseCategory(d.category)) return { error: "Pick what their payments are for." };

  const clash = await db.vendor.findFirst({
    where: { name: { equals: d.name, mode: "insensitive" }, ...(d.id ? { NOT: { id: d.id } } : {}) },
    select: { id: true },
  });
  if (clash) return { error: `${d.name} is already on the list.` };

  const data = {
    name: d.name,
    category: d.category,
    contactPerson: d.contactPerson || null,
    phone: d.phone || null,
    email: d.email || null,
    gstin: d.gstin ? d.gstin.toUpperCase() : null,
    payTo: d.payTo || null,
    notes: d.notes || null,
    recurringDay: d.recurringDay,
    recurringAmount: d.recurringDay && d.recurringAmount ? Math.round(d.recurringAmount * 100) : null,
    isActive: d.isActive,
  };

  const before = d.id ? await db.vendor.findUnique({ where: { id: d.id } }) : null;
  if (d.id && !before) return { error: "That vendor is no longer on the list." };
  const row = before
    ? await db.vendor.update({ where: { id: before.id }, data })
    : await db.vendor.create({ data });

  await audit({
    action: before ? "vendor.update" : "vendor.create",
    entityType: "Vendor",
    entityId: row.id,
    before,
    after: row,
  });
  revalidatePath("/erp/vendors");
  return { ok: true, id: row.id };
}
