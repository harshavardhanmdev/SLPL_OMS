"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { audit } from "@/lib/audit";
import { db } from "@/lib/db";
import { nextQuotationNumber } from "@/lib/number-series";
import { storeProductId } from "@/lib/quoting";
import { lineTotals, quoteTotals, type QuoteLine } from "@/lib/quotation-math";
import { getStaff, requireCapability } from "@/lib/staff-auth";

/**
 * Raising a quotation.
 *
 * Every figure the school sees is recomputed on the server from the lines, so
 * a tampered form cannot quote a price we did not set, and the stored totals
 * always tie to the lines beneath them.
 *
 * A quotation belongs to a school in the customer master, so it shows on that
 * school's history. An executive's quotation waits for the sales manager, as
 * an invoice does; a manager's is approved as it is saved.
 */

type Result = { ok?: boolean; error?: string; id?: string; number?: string };

const DENIED: Record<string, string> = {
  UNAUTHORIZED: "Sign in again to raise a quotation.",
  FORBIDDEN: "Your role can read quotations but not raise them.",
};

const lineSchema = z.object({
  productId: z.string().optional().nullable(),
  description: z.string().trim().min(2, "Every line needs a description").max(200),
  hsnCode: z.string().trim().max(12).optional().or(z.literal("")),
  unit: z.string().trim().max(12).optional().or(z.literal("")),
  quantity: z.number().int().min(1, "Quantity must be at least one").max(1_000_000),
  /** Rupees as typed on the form, converted to paise here. */
  mrp: z.number().min(0).max(100_000_000).optional().nullable(),
  unitPrice: z.number().min(0).max(100_000_000),
  discountBp: z.number().int().min(0).max(10000).optional(),
  /** Rupees off the whole line, when the discount was given as money. */
  discountAmount: z.number().min(0).max(100_000_000).optional(),
  gstRate: z.number().int().min(0).max(5000),
});

const schema = z.object({
  id: z.string().optional(),
  organizationId: z.string().min(1, "Pick the school this is for"),
  contactPerson: z.string().trim().max(80).optional().or(z.literal("")),
  shipToName: z.string().trim().max(120).optional().or(z.literal("")),
  shipToAddress: z.string().trim().max(300).optional().or(z.literal("")),
  placeOfSupply: z.string().trim().min(2, "Place of supply decides the GST split").max(60),
  quotedOn: z.string().min(1, "Pick the quotation date"),
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

  const org = await db.organization.findUnique({ where: { id: d.organizationId } });
  if (!org) return { error: "That school is no longer on record." };

  const quotedOn = new Date(d.quotedOn);
  if (Number.isNaN(quotedOn.getTime())) return { error: "That date is not valid." };
  const validUntil = new Date(quotedOn);
  validUntil.setDate(validUntil.getDate() + d.validDays);

  const lines: QuoteLine[] = d.lines.map((l) => ({
    description: l.description,
    hsnCode: l.hsnCode || null,
    unit: (l.unit || "PCS").toUpperCase(),
    quantity: l.quantity,
    unitPrice: Math.round(l.unitPrice * 100),
    discountBp: l.discountAmount ? 0 : (l.discountBp ?? 0),
    discountAmount: l.discountAmount ? Math.round(l.discountAmount * 100) : 0,
    gstRate: l.gstRate,
  }));
  const totals = quoteTotals(lines, d.placeOfSupply);

  // An approver's save stands; anyone else's goes to the manager, including
  // an edit to something already approved, so a figure cannot change unseen
  const approver = (await requireCapability("invoices.approve")) === null;
  const approval = approver
    ? {
        status: "APPROVED" as const,
        approvedById: staff.breakGlass ? null : staff.id,
        approvedAt: new Date(),
      }
    : { status: "PENDING_APPROVAL" as const, approvedById: null, approvedAt: null };

  const header = {
    organizationId: org.id,
    customerName: org.name,
    contactPerson: d.contactPerson || org.contactPerson,
    phone: org.phone,
    email: org.email,
    addressLine: org.addressLine,
    city: org.city,
    state: org.state,
    pincode: org.pincode,
    gstin: org.gstin,
    shipToName: d.shipToName || null,
    shipToAddress: d.shipToAddress || null,
    placeOfSupply: d.placeOfSupply,
    quotedOn,
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
    rejectedReason: null,
    ...approval,
  };

  const itemRows = d.lines.map((l, i) => {
    const line = lines[i];
    return {
      productId: storeProductId(l.productId),
      description: line.description,
      hsnCode: line.hsnCode,
      unit: line.unit ?? "PCS",
      quantity: line.quantity,
      mrp: l.mrp ? Math.round(l.mrp * 100) : null,
      unitPrice: line.unitPrice,
      discountBp: line.discountBp ?? 0,
      discountAmount: line.discountAmount ?? 0,
      gstRate: line.gstRate,
      lineTotal: lineTotals(line).total,
      sortOrder: i,
    };
  });

  if (d.id) {
    const before = await db.quotation.findUnique({ where: { id: d.id } });
    if (!before) return { error: "That quotation no longer exists." };
    // Once it has gone out, the figures a school is holding must not change
    if (!["DRAFT", "PENDING_APPROVAL", "APPROVED"].includes(before.status)) {
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
      before: { status: before.status, total: before.total },
      after: { number: row.number, status: row.status, total: row.total, customer: row.customerName },
    });
    revalidatePath("/erp/quotations");
    revalidatePath(`/erp/organizations/${org.id}`);
    return { ok: true, id: row.id, number: row.number };
  }

  const row = await db.$transaction(async (tx) =>
    tx.quotation.create({
      data: {
        ...header,
        number: await nextQuotationNumber(tx, quotedOn),
        createdById: staff.breakGlass ? null : staff.id,
        createdEmail: staff.email,
        items: { create: itemRows },
      },
    }),
  );

  await audit({
    action: "quotation.create",
    entityType: "Quotation",
    entityId: row.id,
    after: { number: row.number, status: row.status, total: row.total, customer: row.customerName },
  });
  revalidatePath("/erp/quotations");
  revalidatePath(`/erp/organizations/${org.id}`);
  return { ok: true, id: row.id, number: row.number };
}

const decideSchema = z.object({
  id: z.string().min(1),
  decision: z.enum(["APPROVED", "REJECTED_BACK", "SENT", "ACCEPTED", "REJECTED", "EXPIRED"]),
  reason: z.string().trim().max(200).optional().or(z.literal("")),
});

/**
 * Moving a quotation along.
 *
 * Approving, and sending back with a reason, is the manager's call. Sending
 * it out needs approval first. After that the school decides: accepted, not
 * taken up, or lapsed.
 */
export async function decideQuotation(input: z.infer<typeof decideSchema>): Promise<Result> {
  const parsed = decideSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { id, decision, reason } = parsed.data;

  const needed = ["APPROVED", "REJECTED_BACK"].includes(decision) ? "invoices.approve" : "quotes.write";
  const denied = await requireCapability(needed);
  if (denied) {
    return {
      error: denied === "FORBIDDEN" ? "Only a sales manager or an owner can do that." : "Sign in again.",
    };
  }
  const staff = await getStaff();
  if (!staff) return { error: DENIED.UNAUTHORIZED };

  const before = await db.quotation.findUnique({ where: { id } });
  if (!before) return { error: "That quotation no longer exists." };

  if (decision === "REJECTED_BACK" && !reason) {
    return { error: "Say what needs fixing, so it can be put right." };
  }
  if (decision === "APPROVED" && !["DRAFT", "PENDING_APPROVAL"].includes(before.status)) {
    return { error: "Only a quotation waiting for approval can be approved." };
  }
  if (decision === "SENT" && !["APPROVED", "SENT"].includes(before.status)) {
    return { error: "It has to be approved before it goes to the school." };
  }
  if (["ACCEPTED", "REJECTED", "EXPIRED"].includes(decision) && before.status === "PENDING_APPROVAL") {
    return { error: "It has not been approved yet." };
  }

  const now = new Date();
  const row = await db.quotation.update({
    where: { id },
    data:
      decision === "APPROVED"
        ? {
            status: "APPROVED",
            approvedById: staff.breakGlass ? null : staff.id,
            approvedAt: now,
            rejectedReason: null,
          }
        : decision === "REJECTED_BACK"
          ? { status: "DRAFT", rejectedReason: reason || null, approvedById: null, approvedAt: null }
          : {
              status: decision,
              sentAt: decision === "SENT" ? (before.sentAt ?? now) : before.sentAt,
              decidedAt: ["ACCEPTED", "REJECTED"].includes(decision) ? now : null,
            },
  });

  await audit({
    action: `quotation.${decision.toLowerCase()}`,
    entityType: "Quotation",
    entityId: row.id,
    before: { status: before.status },
    after: { number: row.number, status: row.status, reason: reason || null },
  });
  revalidatePath("/erp/quotations");
  if (row.organizationId) revalidatePath(`/erp/organizations/${row.organizationId}`);
  return { ok: true, id: row.id, number: row.number };
}

const deleteSchema = z.object({ id: z.string().min(1) });

/**
 * Removing a quotation raised by mistake. Owners only, and not once an invoice
 * has been raised from it, so a bill never points at a quotation that is gone.
 * The newest number in the year's series is reused, as with invoices.
 */
export async function deleteQuotation(input: z.infer<typeof deleteSchema>): Promise<Result> {
  const denied = await requireCapability("staff.manage");
  if (denied) {
    return { error: denied === "FORBIDDEN" ? "Only an owner can delete a quotation." : "Sign in again." };
  }
  const parsed = deleteSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const quotation = await db.quotation.findUnique({ where: { id: parsed.data.id }, include: { items: true } });
  if (!quotation) return { error: "That quotation no longer exists." };
  const billed = await db.invoice.findFirst({ where: { quotationId: quotation.id }, select: { number: true } });
  if (billed) return { error: `Invoice ${billed.number} was raised from this quotation, so it stays.` };

  // SLPL/Q/2026-27/0003: the series is the financial year
  const parts = quotation.number.split("/");
  const serial = Number(parts[3] ?? 0);
  const key = `quotation:${parts[2] ?? ""}`;

  let reused = false;
  await db.$transaction(async (tx) => {
    await tx.quotation.delete({ where: { id: quotation.id } });
    const locked = await tx.$queryRaw<{ next: number }[]>`
      SELECT "next" FROM "NumberSeries" WHERE "key" = ${key} FOR UPDATE
    `;
    if (serial > 0 && locked[0]?.next === serial + 1) {
      await tx.$executeRaw`UPDATE "NumberSeries" SET "next" = ${serial}, "updatedAt" = NOW() WHERE "key" = ${key}`;
      reused = true;
    }
  });

  await audit({
    action: "quotation.delete",
    entityType: "Quotation",
    entityId: quotation.id,
    before: {
      number: quotation.number,
      status: quotation.status,
      total: quotation.total,
      customer: quotation.customerName,
      lines: quotation.items.map((i) => `${i.quantity} x ${i.description}`),
    },
    after: { numberReused: reused },
  });
  revalidatePath("/erp/quotations");
  if (quotation.organizationId) revalidatePath(`/erp/organizations/${quotation.organizationId}`);
  return { ok: true, number: quotation.number };
}
