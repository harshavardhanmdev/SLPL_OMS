"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { audit } from "@/lib/audit";
import { db } from "@/lib/db";
import { getStaff, requireCapability } from "@/lib/staff-auth";

/**
 * The rates sales put on quotations and invoices.
 *
 * Separate from store prices by the owner's instruction: a school's rate and
 * the online price move independently. Only an owner edits it, because a rate
 * here is a commercial decision every quotation inherits.
 */

type Result = { ok?: boolean; error?: string; id?: string };

const schema = z.object({
  id: z.string().optional(),
  group: z.string().trim().min(2, "Which group does it belong to?").max(60),
  description: z.string().trim().min(2, "What is it?").max(200),
  hsnCode: z.string().trim().max(12).optional().or(z.literal("")),
  unit: z.string().trim().min(1).max(12),
  /** Rupees as typed. */
  mrp: z.number().min(0).max(100_000_000).optional().nullable(),
  rate: z.number().min(0).max(100_000_000),
  gstRate: z.number().int().min(0).max(5000),
  sortOrder: z.number().int().min(0).max(100000).optional(),
  isActive: z.boolean(),
});

export type PriceItemInput = z.infer<typeof schema>;

export async function savePriceItem(input: PriceItemInput): Promise<Result> {
  const denied = await requireCapability("staff.manage");
  if (denied) {
    return { error: denied === "FORBIDDEN" ? "Only an owner can change the price list." : "Sign in again." };
  }
  const staff = await getStaff();
  if (!staff) return { error: "Sign in again." };

  const parsed = schema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const d = parsed.data;

  const data = {
    group: d.group,
    description: d.description,
    hsnCode: d.hsnCode || null,
    unit: d.unit.toUpperCase(),
    mrp: d.mrp == null ? null : Math.round(d.mrp * 100),
    rate: Math.round(d.rate * 100),
    gstRate: d.gstRate,
    isActive: d.isActive,
    updatedEmail: staff.email,
  };

  const before = d.id ? await db.priceListItem.findUnique({ where: { id: d.id } }) : null;
  if (d.id && !before) return { error: "That item is no longer on the list." };

  let sortOrder = d.sortOrder;
  if (sortOrder === undefined && !before) {
    // New items go to the end of their group
    const last = await db.priceListItem.findFirst({
      where: { group: d.group },
      orderBy: { sortOrder: "desc" },
      select: { sortOrder: true },
    });
    sortOrder = (last?.sortOrder ?? 0) + 10;
  }

  const row = before
    ? await db.priceListItem.update({
        where: { id: before.id },
        data: { ...data, ...(sortOrder !== undefined ? { sortOrder } : {}) },
      })
    : await db.priceListItem.create({ data: { ...data, sortOrder: sortOrder ?? 0 } });

  await audit({
    action: before ? "price.update" : "price.create",
    entityType: "PriceListItem",
    entityId: row.id,
    before: before ? { rate: before.rate, mrp: before.mrp, isActive: before.isActive } : undefined,
    after: { group: row.group, description: row.description, rate: row.rate, mrp: row.mrp, isActive: row.isActive },
  });
  revalidatePath("/erp/prices");
  return { ok: true, id: row.id };
}
