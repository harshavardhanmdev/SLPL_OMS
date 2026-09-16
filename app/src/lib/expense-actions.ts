"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { audit } from "@/lib/audit";
import { db } from "@/lib/db";
import { isExpenseCategory, isPaidFrom } from "@/lib/expense-constants";
import { getStaff, requireCapability } from "@/lib/staff-auth";

/**
 * The director expense log. Every rupee out of the current account, recorded
 * as it is spent, so an audit is answered with a printed statement.
 *
 * Nothing is ever hard deleted: a mistake is voided with a reason and stays in
 * the log, because a statement with silent gaps is worth nothing to an auditor.
 */

type Result = { ok?: boolean; error?: string; voucherNo?: string };

async function ensureFinance(): Promise<string | null> {
  return requireCapability("finance.write");
}

/** SLPL-E-YYMM-XXXXX, mirroring the order and receipt numbers. */
async function generateVoucherNo(spentAt: Date): Promise<string> {
  const stamp = `${String(spentAt.getFullYear()).slice(2)}${String(spentAt.getMonth() + 1).padStart(2, "0")}`;
  for (let i = 0; i < 5; i++) {
    const rand = randomBytes(3).toString("hex").toUpperCase().slice(0, 5);
    const candidate = `SLPL-E-${stamp}-${rand}`;
    const clash = await db.expense.findUnique({ where: { voucherNo: candidate } });
    if (!clash) return candidate;
  }
  throw new Error("Could not allocate a voucher number - please retry.");
}

const expenseSchema = z.object({
  id: z.string().optional(),
  spentAt: z.string().min(1, "Pick the date on the bill"),
  // Rupees as typed, converted to paise here so the form never deals in paise
  amount: z
    .number()
    .positive("Enter an amount")
    .max(10_000_000, "That is over a crore - split it or check the figure"),
  category: z.string().min(1, "Pick a category"),
  paidFrom: z.string().min(1),
  payee: z.string().trim().max(120).optional().or(z.literal("")),
  note: z.string().trim().max(500).optional().or(z.literal("")),
  reference: z.string().trim().max(80).optional().or(z.literal("")),
  billImage: z.string().max(300).nullable().optional(),
  gstAmount: z.number().min(0).max(10_000_000).nullable().optional(),
  vendorGstin: z.string().trim().max(20).optional().or(z.literal("")),
});

export type ExpenseInput = z.infer<typeof expenseSchema>;

export async function saveExpense(input: ExpenseInput): Promise<Result> {
  const denied = await ensureFinance();
  if (denied) return { error: denied };

  const parsed = expenseSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const d = parsed.data;

  if (!isExpenseCategory(d.category)) return { error: "Pick a category from the list." };
  if (!isPaidFrom(d.paidFrom)) return { error: "Pick how it was paid." };

  const spentAt = new Date(d.spentAt);
  if (Number.isNaN(spentAt.getTime())) return { error: "That date is not valid." };
  if (spentAt.getTime() > Date.now() + 24 * 60 * 60 * 1000) {
    return { error: "That date is in the future." };
  }

  const amount = Math.round(d.amount * 100);
  const gstAmount = d.gstAmount != null ? Math.round(d.gstAmount * 100) : null;
  if (gstAmount != null && gstAmount > amount) {
    return { error: "GST cannot be more than the total amount." };
  }

  const data = {
    spentAt,
    amount,
    category: d.category,
    paidFrom: d.paidFrom,
    payee: d.payee || null,
    note: d.note || null,
    reference: d.reference || null,
    billImage: d.billImage || null,
    gstAmount,
    vendorGstin: d.vendorGstin || null,
  };

  const staff = await getStaff();
  const before = d.id ? await db.expense.findUnique({ where: { id: d.id } }) : null;
  const row = d.id
    ? await db.expense.update({ where: { id: d.id }, data })
    : await db.expense.create({
        data: {
          ...data,
          voucherNo: await generateVoucherNo(spentAt),
          enteredBy: staff?.name ?? "Director",
        },
      });

  await audit({
    action: d.id ? "expense.update" : "expense.create",
    entityType: "Expense",
    entityId: row.id,
    before,
    after: row,
  });
  revalidatePath("/erp/expenses");
  return { ok: true, voucherNo: row.voucherNo };
}

/**
 * Voiding keeps the voucher number and the row, and writes the reason into the
 * note. An auditor seeing a gap in the numbers asks why; an auditor seeing a
 * voided line with a reason does not.
 */
export async function voidExpense(id: string, reason: string): Promise<Result> {
  const denied = await ensureFinance();
  if (denied) return { error: denied };
  const why = reason.trim();
  if (why.length < 3) return { error: "Say why it is being voided." };

  const existing = await db.expense.findUnique({ where: { id } });
  if (!existing) return { error: "That entry no longer exists." };
  if (existing.amount === 0) return { error: "This entry is already voided." };

  const row = await db.expense.update({
    where: { id },
    data: {
      amount: 0,
      gstAmount: null,
      note: `VOIDED: ${why}${existing.note ? ` (was: ${existing.note})` : ""}`,
    },
  });
  await audit({
    action: "expense.void",
    entityType: "Expense",
    entityId: id,
    before: existing,
    after: row,
  });
  revalidatePath("/erp/expenses");
  return { ok: true };
}
