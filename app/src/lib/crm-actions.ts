"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { audit } from "@/lib/audit";
import { db } from "@/lib/db";
import { nextReceiptNumber } from "@/lib/number-series";
import { startInvoiceSubscriptions, stopInvoiceSubscriptions } from "@/lib/subscription-notify";
import { getStaff, requireCapability } from "@/lib/staff-auth";

/**
 * The field work: visits, samples, gifts, money received and targets.
 *
 * Deliberately one module, because from a salesperson's point of view these
 * are all the same act of recording what happened at a school this morning.
 */

type Result = { ok?: boolean; error?: string; id?: string; number?: string };

const DENIED: Record<string, string> = {
  UNAUTHORIZED: "Sign in again.",
  FORBIDDEN: "Your role cannot do that.",
};

// ── Visits ───────────────────────────────────────────────────────────────────

const visitSchema = z.object({
  id: z.string().optional(),
  organizationId: z.string().min(1, "Pick the school"),
  visitedOn: z.string().min(1, "Pick the date"),
  kind: z.enum(["VISIT", "CALL", "MEETING", "DEMO", "SAMPLE_DROP", "FOLLOW_UP", "PAYMENT_CHASE", "NOTE"]),
  metWith: z.string().trim().max(80).optional().or(z.literal("")),
  summary: z.string().trim().min(3, "Say what happened").max(1000),
  outcome: z.string().trim().max(500).optional().or(z.literal("")),
  // The owner's rule: nothing sits in the system saying only "Called"
  nextAction: z.string().trim().min(3, "What happens next? This is not optional").max(200),
  nextActionOn: z.string().min(1, "When? This is not optional"),
  converted: z.boolean().optional(),
  invoiceId: z.string().optional().nullable(),
});

export type VisitInput = z.infer<typeof visitSchema>;

export async function saveVisit(input: VisitInput): Promise<Result> {
  const denied = await requireCapability("crm.write");
  if (denied) return { error: DENIED[denied] };
  const staff = await getStaff();
  if (!staff) return { error: DENIED.UNAUTHORIZED };

  const parsed = visitSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const d = parsed.data;

  const visitedOn = new Date(d.visitedOn);
  const nextActionOn = new Date(d.nextActionOn);
  if (Number.isNaN(visitedOn.getTime()) || Number.isNaN(nextActionOn.getTime())) {
    return { error: "One of those dates is not valid." };
  }

  const data = {
    organizationId: d.organizationId,
    visitedOn,
    kind: d.kind,
    metWith: d.metWith || null,
    summary: d.summary,
    outcome: d.outcome || null,
    nextAction: d.nextAction,
    nextActionOn,
    converted: d.converted ?? false,
    invoiceId: d.invoiceId || null,
  };

  const row = d.id
    ? await db.visit.update({ where: { id: d.id }, data })
    : await db.visit.create({
        data: { ...data, byId: staff.breakGlass ? null : staff.id, byEmail: staff.email },
      });

  // A school that has been visited is no longer a cold lead
  await db.organization.updateMany({
    where: { id: d.organizationId, status: "LEAD" },
    data: { status: "ACTIVE" },
  });

  await audit({
    action: d.id ? "visit.update" : "visit.create",
    entityType: "Visit",
    entityId: row.id,
    after: { organizationId: row.organizationId, kind: row.kind, converted: row.converted },
  });
  revalidatePath("/erp/sales");
  revalidatePath(`/erp/organizations/${d.organizationId}`);
  return { ok: true, id: row.id };
}

// ── Gifts ────────────────────────────────────────────────────────────────────

const giftSchema = z.object({
  organizationId: z.string().min(1, "Pick the school"),
  description: z.string().trim().min(2, "What was given?").max(200),
  /** Rupees as typed. */
  value: z.number().min(0).max(10_000_000).optional().nullable(),
  givenToName: z.string().trim().max(80).optional().or(z.literal("")),
  givenOn: z.string().min(1, "Pick the date"),
  notes: z.string().trim().max(500).optional().or(z.literal("")),
});

export async function saveGift(input: z.infer<typeof giftSchema>): Promise<Result> {
  const denied = await requireCapability("crm.write");
  if (denied) return { error: DENIED[denied] };
  const staff = await getStaff();
  if (!staff) return { error: DENIED.UNAUTHORIZED };

  const parsed = giftSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const d = parsed.data;

  const row = await db.gift.create({
    data: {
      organizationId: d.organizationId,
      description: d.description,
      value: d.value ? Math.round(d.value * 100) : null,
      givenToName: d.givenToName || null,
      givenOn: new Date(d.givenOn),
      notes: d.notes || null,
      givenById: staff.breakGlass ? null : staff.id,
      givenEmail: staff.email,
    },
  });

  await audit({
    action: "gift.create",
    entityType: "Gift",
    entityId: row.id,
    after: { organizationId: row.organizationId, description: row.description, value: row.value },
  });
  revalidatePath("/erp/gifts");
  revalidatePath(`/erp/organizations/${d.organizationId}`);
  return { ok: true, id: row.id };
}

// ── Money received ───────────────────────────────────────────────────────────

const receiptSchema = z.object({
  organizationId: z.string().min(1, "Pick the school"),
  receivedOn: z.string().min(1, "Pick the date"),
  /** Rupees as typed. */
  amount: z.number().min(0.01, "Enter the amount").max(100_000_000),
  mode: z.enum(["CASH", "BANK_TRANSFER", "CHEQUE", "UPI", "CARD", "RAZORPAY", "OTHER"]),
  reference: z.string().trim().max(80).optional().or(z.literal("")),
  notes: z.string().trim().max(500).optional().or(z.literal("")),
  /** Invoices this payment settles, oldest first if left empty. */
  invoiceIds: z.array(z.string()).optional(),
});

export async function recordReceipt(input: z.infer<typeof receiptSchema>): Promise<Result> {
  const denied = await requireCapability("finance.write");
  if (denied) {
    return { error: denied === "FORBIDDEN" ? "Only accounts or an owner can record money." : "Sign in again." };
  }
  const staff = await getStaff();
  if (!staff) return { error: DENIED.UNAUTHORIZED };

  const parsed = receiptSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const d = parsed.data;
  const amount = Math.round(d.amount * 100);
  const receivedOn = new Date(d.receivedOn);

  const row = await db.$transaction(async (tx) => {
    // Lock this school's bills before reading what is owed on them, so two
    // payments recorded at the same moment queue instead of both settling the
    // same bill and paying it twice over.
    await tx.$queryRaw`
      SELECT "id" FROM "Invoice" WHERE "organizationId" = ${d.organizationId} FOR UPDATE
    `;

    // Settle the oldest unpaid bills first unless specific ones were chosen
    const candidates = await tx.invoice.findMany({
      where: {
        organizationId: d.organizationId,
        status: { in: ["APPROVED", "SENT"] },
        ...(d.invoiceIds?.length ? { id: { in: d.invoiceIds } } : {}),
      },
      orderBy: { invoiceDate: "asc" },
      include: { allocations: { select: { amount: true } } },
    });

    const receipt = await tx.receipt.create({
      data: {
        number: await nextReceiptNumber(tx, receivedOn),
        organizationId: d.organizationId,
        receivedOn,
        amount,
        mode: d.mode,
        reference: d.reference || null,
        notes: d.notes || null,
        recordedEmail: staff.email,
      },
    });

    let left = amount;
    for (const invoice of candidates) {
      if (left <= 0) break;
      const already = invoice.allocations.reduce((s, a) => s + a.amount, 0);
      const owed = invoice.total - already;
      if (owed <= 0) continue;
      const put = Math.min(owed, left);
      await tx.receiptAllocation.create({
        data: { receiptId: receipt.id, invoiceId: invoice.id, amount: put },
      });
      left -= put;
      if (put === owed) {
        await tx.invoice.update({ where: { id: invoice.id }, data: { status: "PAID" } });
        // A GenZ Times subscription on the bill joins the posting list now
        await startInvoiceSubscriptions(tx, invoice.id, receivedOn);
      }
    }
    return receipt;
  });

  await audit({
    action: "receipt.create",
    entityType: "Receipt",
    entityId: row.id,
    after: { number: row.number, amount: row.amount, organizationId: row.organizationId },
  });
  revalidatePath("/erp/payments");
  revalidatePath("/erp/organizations");
  revalidatePath(`/erp/organizations/${d.organizationId}`);
  revalidatePath("/erp/subscriptions");
  return { ok: true, id: row.id, number: row.number };
}

const voidReceiptSchema = z.object({
  id: z.string().min(1),
  reason: z.string().trim().min(3, "Say why it is being voided").max(300),
});

/**
 * Takes a payment back off the books, for a bounced cheque or one recorded
 * against the wrong school.
 *
 * The receipt row and its number stay, because a gap in the receipt series
 * reads as money that went missing. What goes is the money's effect: its
 * allocations, and the PAID status of any bill that no longer adds up.
 */
export async function voidReceipt(input: z.infer<typeof voidReceiptSchema>): Promise<Result> {
  const denied = await requireCapability("finance.write");
  if (denied) {
    return { error: denied === "FORBIDDEN" ? "Only accounts or an owner can void a payment." : "Sign in again." };
  }

  const parsed = voidReceiptSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { id, reason } = parsed.data;

  const outcome = await db.$transaction(async (tx) => {
    // Only the first of two people voiding at once gets through; the update
    // locks the row, so the second waits and then finds it already voided
    const voided = await tx.receipt.updateMany({
      where: { id, voidedAt: null },
      data: { voidedAt: new Date(), voidReason: reason },
    });
    if (voided.count === 0) return null;

    const receipt = await tx.receipt.findUniqueOrThrow({
      where: { id },
      include: { allocations: { include: { invoice: { select: { number: true } } } } },
    });
    await tx.receiptAllocation.deleteMany({ where: { receiptId: id } });

    const touched = await tx.invoice.findMany({
      where: { id: { in: receipt.allocations.map((a) => a.invoiceId) }, status: "PAID" },
      include: { allocations: { select: { amount: true } } },
    });
    const reopened: { id: string; number: string; status: string }[] = [];
    for (const invoice of touched) {
      const covered = invoice.allocations.reduce((s, a) => s + a.amount, 0);
      if (covered >= invoice.total) continue;
      const status = invoice.sentAt ? "SENT" : "APPROVED";
      await tx.invoice.update({ where: { id: invoice.id }, data: { status } });
      reopened.push({ id: invoice.id, number: invoice.number, status });
    }
    // An unpaid bill no longer earns its subscription
    await stopInvoiceSubscriptions(tx, reopened.map((r) => r.id));
    return { receipt, reopened };
  });

  if (!outcome) return { error: "That payment is not on the books, or is already voided." };
  const { receipt, reopened } = outcome;

  await audit({
    action: "receipt.void",
    entityType: "Receipt",
    entityId: receipt.id,
    before: {
      number: receipt.number,
      amount: receipt.amount,
      allocations: receipt.allocations.map((a) => ({
        invoiceId: a.invoiceId,
        invoice: a.invoice.number,
        amount: a.amount,
      })),
    },
    after: { voidedAt: receipt.voidedAt, voidReason: receipt.voidReason, reopened },
  });
  revalidatePath("/erp/payments");
  revalidatePath("/erp/invoices");
  revalidatePath(`/erp/organizations/${receipt.organizationId}`);
  revalidatePath("/erp/subscriptions");
  return { ok: true, id: receipt.id, number: receipt.number };
}

// ── Targets ──────────────────────────────────────────────────────────────────

const targetSchema = z.object({
  scope: z.enum(["COMPANY", "PERSON"]),
  ownerId: z.string().optional().nullable(),
  period: z.enum(["MONTH", "YEAR"]),
  periodStart: z.string().min(1, "Pick the period"),
  /** Rupees as typed. */
  revenueTarget: z.number().min(0).max(1_000_000_000),
  visitTarget: z.number().int().min(0).max(100000),
  organizationTarget: z.number().int().min(0).max(100000),
});

export async function saveTarget(input: z.infer<typeof targetSchema>): Promise<Result> {
  const denied = await requireCapability("staff.manage");
  if (denied) {
    return { error: denied === "FORBIDDEN" ? "Only an owner can set targets." : "Sign in again." };
  }
  const staff = await getStaff();
  if (!staff) return { error: DENIED.UNAUTHORIZED };

  const parsed = targetSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const d = parsed.data;
  if (d.scope === "PERSON" && !d.ownerId) return { error: "Pick whose target this is." };

  // Read as a calendar date on the server's clock, the same way the sales
  // banner works out the start of a month, so the two always meet
  const [y, m, day] = d.periodStart.split("-").map(Number);
  const periodStart = new Date(y, (m || 1) - 1, day || 1);
  if (Number.isNaN(periodStart.getTime())) return { error: "That period is not valid." };

  // Not an upsert: Postgres does not treat two NULL owners as the same row, so
  // a company target would never match its own unique index.
  const ownerId = d.scope === "PERSON" ? d.ownerId! : null;
  const figures = {
    revenueTarget: BigInt(Math.round(d.revenueTarget * 100)),
    visitTarget: d.visitTarget,
    organizationTarget: d.organizationTarget,
    setByEmail: staff.email,
  };
  const existing = await db.salesTarget.findFirst({
    where: { scope: d.scope, ownerId, period: d.period, periodStart },
    select: { id: true },
  });
  const row = existing
    ? await db.salesTarget.update({ where: { id: existing.id }, data: figures })
    : await db.salesTarget.create({
        data: { scope: d.scope, ownerId, period: d.period, periodStart, ...figures },
      });

  await audit({
    action: "target.save",
    entityType: "SalesTarget",
    entityId: row.id,
    after: { scope: row.scope, period: row.period, revenueTarget: Number(row.revenueTarget) },
  });
  revalidatePath("/erp/sales");
  revalidatePath("/erp/targets");
  return { ok: true, id: row.id };
}
