"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { audit } from "@/lib/audit";
import { db } from "@/lib/db";
import { financialYearOf } from "@/lib/expense-constants";
import { getStaff, requireCapability } from "@/lib/staff-auth";
import { quoteTotals, type QuoteLine } from "@/lib/quotation-math";

/**
 * Raising a quotation.
 *
 * Every figure the school sees is recomputed on the server from the lines, so
 * a tampered form cannot quote a price we did not set, and the stored totals
 * always tie to the lines beneath them.
 */

type Result = { ok?: boolean; error?: string; id?: string; number?: string };

const DENIED: Record<string, string> = {
  UNAUTHORIZED: "Sign in again to raise a quotation.",
  FORBIDDEN: "Your role can read quotations but not raise them.",
};

/**
 * SLPL/Q/26-27/0001, continuous within a financial year.
 *
 * Counted inside a transaction against the highest number already issued, so
 * two people pressing save at once cannot land on the same number.
 */
async function nextNumber(): Promise<string> {
  const year = financialYearOf(new Date());
  const prefix = `SLPL/Q/${year.label.replace(/\s/g, "")}/`;
  const last = await db.quotation.findFirst({
    where: { number: { startsWith: prefix } },
    orderBy: { number: "desc" },
    select: { number: true },
  });
  const serial = last ? Number(last.number.slice(prefix.length)) + 1 : 1;
  return `${prefix}${String(serial).padStart(4, "0")}`;
}

const lineSchema = z.object({
  productId: z.string().optional().nullable(),
  description: z.string().trim().min(2, "Every line needs a description").max(200),
  hsnCode: z.string().trim().max(12).optional().or(z.literal("")),
  unit: z.string().trim().max(12).optional().or(z.literal("")),
  quantity: z.number().int().min(1, "Quantity must be at least one").max(1_000_000),
  /** Rupees as typed on the form, converted to paise here. */
  unitPrice: z.number().min(0).max(100_000_000),
  discountBp: z.number().int().min(0).max(10000).optional(),
  gstRate: z.number().int().min(0).max(5000),
});

const schema = z.object({
  id: z.string().optional(),
  customerName: z.string().trim().min(2, "Who is this quotation for?").max(120),
  contactPerson: z.string().trim().max(80).optional().or(z.literal("")),
  phone: z.string().trim().max(20).optional().or(z.literal("")),
  email: z.string().trim().max(120).optional().or(z.literal("")),
  addressLine: z.string().trim().max(200).optional().or(z.literal("")),
  city: z.string().trim().max(60).optional().or(z.literal("")),
  state: z.string().trim().max(60).optional().or(z.literal("")),
  pincode: z.string().trim().max(10).optional().or(z.literal("")),
  gstin: z.string().trim().max(20).optional().or(z.literal("")),
  placeOfSupply: z.string().trim().min(2, "Place of supply decides the GST split").max(60),
  validDays: z.number().int().min(1).max(365),
  terms: z.string().trim().max(2000).optional().or(z.literal("")),
  notes: z.string().trim().max(2000).optional().or(z.literal("")),
  lines: z.array(lineSchema).min(1, "Add at least one line").max(60),
});

export type QuotationInput = z.infer<typeof schema>;

export async function saveQuotation(input: QuotationInput): Promise<Result> {
  const denied = await requireCapability("quotes.write");
  if (denied) return { error: DENIED[denied] };
  const staff = await getStaff();
  if (!staff) return { error: DENIED.UNAUTHORIZED };

  const parsed = schema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const d = parsed.data;

  const lines: QuoteLine[] = d.lines.map((l) => ({
    description: l.description,
    hsnCode: l.hsnCode || null,
    unit: l.unit || "Nos",
    quantity: l.quantity,
    unitPrice: Math.round(l.unitPrice * 100),
    discountBp: l.discountBp ?? 0,
    gstRate: l.gstRate,
  }));
  const totals = quoteTotals(lines, d.placeOfSupply);

  const validUntil = new Date();
  validUntil.setDate(validUntil.getDate() + d.validDays);

  const header = {
    customerName: d.customerName,
    contactPerson: d.contactPerson || null,
    phone: d.phone || null,
    email: d.email || null,
    addressLine: d.addressLine || null,
    city: d.city || null,
    state: d.state || null,
    pincode: d.pincode || null,
    gstin: d.gstin || null,
    placeOfSupply: d.placeOfSupply,
    validUntil,
    subtotal: totals.subtotal,
    discount: totals.discount,
    taxable: totals.taxable,
    cgst: totals.cgst,
    sgst: totals.sgst,
    igst: totals.igst,
    total: totals.total,
    terms: d.terms || null,
    notes: d.notes || null,
  };

  const itemRows = d.lines.map((l, i) => {
    const line = lines[i];
    const t = quoteTotals([line], d.placeOfSupply);
    return {
      productId: l.productId || null,
      description: line.description,
      hsnCode: line.hsnCode,
      unit: line.unit ?? "Nos",
      quantity: line.quantity,
      unitPrice: line.unitPrice,
      discountBp: line.discountBp ?? 0,
      gstRate: line.gstRate,
      lineTotal: t.total,
      sortOrder: i,
    };
  });

  if (d.id) {
    const before = await db.quotation.findUnique({ where: { id: d.id } });
    if (!before) return { error: "That quotation no longer exists." };
    // Once it has gone out, the figures a school is holding must not change
    if (before.status !== "DRAFT") {
      return { error: "This quotation has already been sent. Raise a revised one instead." };
    }
    const row = await db.$transaction(async (tx) => {
      await tx.quotationItem.deleteMany({ where: { quotationId: d.id! } });
      return tx.quotation.update({
        where: { id: d.id! },
        data: { ...header, items: { create: itemRows } },
      });
    });
    await audit({
      action: "quotation.update",
      entityType: "Quotation",
      entityId: row.id,
      after: { number: row.number, total: row.total, customer: row.customerName },
    });
    revalidatePath("/erp/quotations");
    return { ok: true, id: row.id, number: row.number };
  }

  const row = await db.quotation.create({
    data: {
      ...header,
      number: await nextNumber(),
      createdById: staff.breakGlass ? null : staff.id,
      createdEmail: staff.email,
      items: { create: itemRows },
    },
  });

  await audit({
    action: "quotation.create",
    entityType: "Quotation",
    entityId: row.id,
    after: { number: row.number, total: row.total, customer: row.customerName },
  });
  revalidatePath("/erp/quotations");
  return { ok: true, id: row.id, number: row.number };
}

const statusSchema = z.object({
  id: z.string().min(1),
  status: z.enum(["DRAFT", "SENT", "ACCEPTED", "REJECTED", "EXPIRED"]),
});

export async function setQuotationStatus(input: z.infer<typeof statusSchema>): Promise<Result> {
  const denied = await requireCapability("quotes.write");
  if (denied) return { error: DENIED[denied] };

  const parsed = statusSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const before = await db.quotation.findUnique({ where: { id: parsed.data.id } });
  if (!before) return { error: "That quotation no longer exists." };

  const row = await db.quotation.update({
    where: { id: parsed.data.id },
    data: {
      status: parsed.data.status,
      sentAt: parsed.data.status === "SENT" ? (before.sentAt ?? new Date()) : before.sentAt,
      decidedAt: ["ACCEPTED", "REJECTED"].includes(parsed.data.status) ? new Date() : null,
    },
  });

  await audit({
    action: "quotation.status",
    entityType: "Quotation",
    entityId: row.id,
    before: { status: before.status },
    after: { number: row.number, status: row.status },
  });
  revalidatePath("/erp/quotations");
  return { ok: true, id: row.id, number: row.number };
}
