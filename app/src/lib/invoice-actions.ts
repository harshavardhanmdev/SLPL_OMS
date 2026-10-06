"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { audit } from "@/lib/audit";
import { db } from "@/lib/db";
import { nextInvoiceNumber } from "@/lib/number-series";
import { documentKindFor, documentTotals, type QuoteLine } from "@/lib/quotation-math";
import { getStaff, requireCapability } from "@/lib/staff-auth";

/**
 * Raising a bill.
 *
 * Every figure is recomputed on the server from the lines, so a tampered form
 * cannot bill a price we did not set. The document type is decided here rather
 * than offered as a choice, because picking Bill of Supply on an invoice that
 * carries GST is exactly the error that surfaces in an audit two years later.
 */

type Result = { ok?: boolean; error?: string; id?: string; number?: string };

const DENIED: Record<string, string> = {
  UNAUTHORIZED: "Sign in again.",
  FORBIDDEN: "Your role cannot raise invoices.",
};

const lineSchema = z.object({
  productId: z.string().optional().nullable(),
  description: z.string().trim().min(2, "Every line needs a description").max(200),
  hsnCode: z.string().trim().max(12).optional().or(z.literal("")),
  unit: z.string().trim().max(12).optional().or(z.literal("")),
  quantity: z.number().int().min(1, "Quantity must be at least one").max(1_000_000),
  /** Rupees as typed. */
  mrp: z.number().min(0).max(100_000_000).optional().nullable(),
  unitPrice: z.number().min(0).max(100_000_000),
  discountBp: z.number().int().min(0).max(10000).optional(),
  gstRate: z.number().int().min(0).max(5000),
});

const schema = z.object({
  id: z.string().optional(),
  organizationId: z.string().min(1, "Pick the school this is for"),
  productLine: z.enum(["MAG", "BOOK", "SVC"]),
  invoiceDate: z.string().min(1, "Pick the invoice date"),
  dueDays: z.number().int().min(0).max(365),
  placeOfSupply: z.string().trim().min(2, "Place of supply decides the GST split").max(60),
  billDiscountBp: z.number().int().min(0).max(10000).optional(),
  terms: z.string().trim().max(2000).optional().or(z.literal("")),
  notes: z.string().trim().max(2000).optional().or(z.literal("")),
  quotationId: z.string().optional().nullable(),
  lines: z.array(lineSchema).min(1, "Add at least one line").max(60),
});

export type InvoiceInput = z.infer<typeof schema>;

export async function saveInvoice(input: InvoiceInput): Promise<Result> {
  const denied = await requireCapability("invoices.write");
  if (denied) return { error: DENIED[denied] };
  const staff = await getStaff();
  if (!staff) return { error: DENIED.UNAUTHORIZED };

  const parsed = schema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const d = parsed.data;

  const org = await db.organization.findUnique({ where: { id: d.organizationId } });
  if (!org) return { error: "That organisation no longer exists." };

  const invoiceDate = new Date(d.invoiceDate);
  if (Number.isNaN(invoiceDate.getTime())) return { error: "That date is not valid." };
  const dueDate = new Date(invoiceDate);
  dueDate.setDate(dueDate.getDate() + d.dueDays);

  const lines: QuoteLine[] = d.lines.map((l) => ({
    description: l.description,
    hsnCode: l.hsnCode || null,
    unit: l.unit || "Nos",
    quantity: l.quantity,
    unitPrice: Math.round(l.unitPrice * 100),
    discountBp: l.discountBp ?? 0,
    gstRate: l.gstRate,
  }));
  const billDiscountBp = d.billDiscountBp ?? 0;
  const totals = documentTotals(lines, d.placeOfSupply, billDiscountBp);

  const header = {
    kind: documentKindFor(lines),
    productLine: d.productLine,
    organizationId: org.id,
    customerName: org.name,
    contactPerson: org.contactPerson,
    phone: org.phone,
    email: org.email,
    addressLine: org.addressLine,
    city: org.city,
    state: org.state,
    pincode: org.pincode,
    gstin: org.gstin,
    placeOfSupply: d.placeOfSupply,
    invoiceDate,
    dueDate,
    subtotal: totals.subtotal,
    billDiscountBp,
    discount: totals.discount,
    taxable: totals.taxable,
    cgst: totals.cgst,
    sgst: totals.sgst,
    igst: totals.igst,
    total: totals.total,
    terms: d.terms || null,
    notes: d.notes || null,
    quotationId: d.quotationId || null,
  };

  const itemRows = d.lines.map((l, i) => {
    const line = lines[i];
    const t = documentTotals([line], d.placeOfSupply, billDiscountBp);
    return {
      productId: l.productId || null,
      description: line.description,
      hsnCode: line.hsnCode,
      unit: line.unit ?? "Nos",
      quantity: line.quantity,
      mrp: l.mrp ? Math.round(l.mrp * 100) : null,
      unitPrice: line.unitPrice,
      discountBp: line.discountBp ?? 0,
      gstRate: line.gstRate,
      lineTotal: t.total,
      sortOrder: i,
    };
  });

  if (d.id) {
    const before = await db.invoice.findUnique({ where: { id: d.id } });
    if (!before) return { error: "That invoice no longer exists." };
    if (!["DRAFT", "PENDING_APPROVAL"].includes(before.status)) {
      return { error: "This invoice has been approved. Raise a credit note or a fresh one." };
    }
    const row = await db.$transaction(async (tx) => {
      await tx.invoiceItem.deleteMany({ where: { invoiceId: d.id! } });
      return tx.invoice.update({
        where: { id: d.id! },
        data: { ...header, items: { create: itemRows } },
      });
    });
    await audit({
      action: "invoice.update",
      entityType: "Invoice",
      entityId: row.id,
      after: { number: row.number, total: row.total, customer: row.customerName },
    });
    revalidatePath("/erp/invoices");
    return { ok: true, id: row.id, number: row.number };
  }

  // Anything an approver raises is approved already; an executive waits
  const canApprove = await requireCapability("invoices.approve");
  const status = canApprove === null ? "APPROVED" : "PENDING_APPROVAL";

  const row = await db.$transaction(async (tx) => {
    const number = await nextInvoiceNumber(tx, invoiceDate, d.productLine, org.code);
    return tx.invoice.create({
      data: {
        ...header,
        number,
        status,
        approvedById: canApprove === null && !staff.breakGlass ? staff.id : null,
        approvedAt: canApprove === null ? new Date() : null,
        createdById: staff.breakGlass ? null : staff.id,
        createdEmail: staff.email,
        items: { create: itemRows },
      },
    });
  });

  await audit({
    action: "invoice.create",
    entityType: "Invoice",
    entityId: row.id,
    after: {
      number: row.number,
      kind: row.kind,
      status: row.status,
      total: row.total,
      customer: row.customerName,
    },
  });
  revalidatePath("/erp/invoices");
  return { ok: true, id: row.id, number: row.number };
}

const decideSchema = z.object({
  id: z.string().min(1),
  decision: z.enum(["APPROVED", "REJECTED", "SENT", "CANCELLED"]),
  reason: z.string().trim().max(200).optional().or(z.literal("")),
});

export async function decideInvoice(input: z.infer<typeof decideSchema>): Promise<Result> {
  const parsed = decideSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { id, decision, reason } = parsed.data;

  // Approving and rejecting is the manager's call; sending is anyone who writes
  const needed = ["APPROVED", "REJECTED"].includes(decision) ? "invoices.approve" : "invoices.write";
  const denied = await requireCapability(needed);
  if (denied) {
    return {
      error: denied === "FORBIDDEN" ? "Only a sales manager or an owner can do that." : "Sign in again.",
    };
  }
  const staff = await getStaff();
  if (!staff) return { error: DENIED.UNAUTHORIZED };

  const before = await db.invoice.findUnique({ where: { id } });
  if (!before) return { error: "That invoice no longer exists." };

  if (decision === "REJECTED" && !reason) {
    return { error: "Say why it is being sent back, so it can be fixed." };
  }
  if (decision === "SENT" && before.status !== "APPROVED") {
    return { error: "It has to be approved before it can go out." };
  }

  const row = await db.invoice.update({
    where: { id },
    data: {
      status: decision === "REJECTED" ? "DRAFT" : decision,
      approvedById:
        decision === "APPROVED" && !staff.breakGlass ? staff.id : before.approvedById,
      approvedAt: decision === "APPROVED" ? new Date() : before.approvedAt,
      rejectedReason: decision === "REJECTED" ? (reason ?? null) : null,
      sentAt: decision === "SENT" ? (before.sentAt ?? new Date()) : before.sentAt,
      cancelledAt: decision === "CANCELLED" ? new Date() : null,
    },
  });

  await audit({
    action: `invoice.${decision.toLowerCase()}`,
    entityType: "Invoice",
    entityId: row.id,
    before: { status: before.status },
    after: { number: row.number, status: row.status, reason: reason || null },
  });
  revalidatePath("/erp/invoices");
  return { ok: true, id: row.id, number: row.number };
}
