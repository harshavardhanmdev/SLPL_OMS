import "server-only";

import { db } from "@/lib/db";

/**
 * What a school owes.
 *
 * Previous and current balance on an invoice are worked out from the invoices
 * raised and the money actually received, never typed. A balance somebody
 * types is a balance that drifts, and nobody notices until a school disputes
 * it.
 */

/** Invoices that count as money owed. Drafts and cancellations do not. */
export const BILLED_STATUSES = ["APPROVED", "SENT", "PAID"] as const;

export type AccountPosition = {
  billed: number;
  received: number;
  /** Goods sent back, less anything paid back to the school. */
  returned: number;
  outstanding: number;
  oldestUnpaidOn: Date | null;
  oldestUnpaidDays: number;
};

export async function accountPosition(
  organizationId: string,
  upTo?: Date,
): Promise<AccountPosition> {
  const [invoices, receipts, returns] = await Promise.all([
    db.invoice.findMany({
      where: {
        organizationId,
        status: { in: [...BILLED_STATUSES] },
        ...(upTo ? { invoiceDate: { lte: upTo } } : {}),
      },
      select: { id: true, total: true, invoiceDate: true, allocations: { select: { amount: true } } },
      orderBy: { invoiceDate: "asc" },
    }),
    db.receipt.aggregate({
      where: { organizationId, voidedAt: null, ...(upTo ? { receivedOn: { lte: upTo } } : {}) },
      _sum: { amount: true },
    }),
    db.salesReturn.aggregate({
      where: { organizationId, ...(upTo ? { returnedOn: { lte: upTo } } : {}) },
      _sum: { total: true, refunded: true },
    }),
  ]);

  const billed = invoices.reduce((sum, i) => sum + i.total, 0);
  const received = receipts._sum.amount ?? 0;
  const returned = (returns._sum.total ?? 0) - (returns._sum.refunded ?? 0);

  const unpaid = invoices.find(
    (i) => i.allocations.reduce((s, a) => s + a.amount, 0) < i.total,
  );
  const oldestUnpaidOn = unpaid?.invoiceDate ?? null;

  return {
    billed,
    received,
    returned,
    outstanding: billed - received - returned,
    oldestUnpaidOn,
    oldestUnpaidDays: oldestUnpaidOn
      ? Math.max(0, Math.floor((Date.now() - oldestUnpaidOn.getTime()) / 86400000))
      : 0,
  };
}

/**
 * The three figures the owner's sample invoice carries.
 *
 * Previous balance is what was outstanding the moment before this bill was
 * raised, so the arithmetic on the page reads as a running account.
 */
export async function invoiceBalances(invoiceId: string): Promise<{
  previousBalance: number;
  receivedAmount: number;
  currentBalance: number;
}> {
  const invoice = await db.invoice.findUnique({
    where: { id: invoiceId },
    select: {
      organizationId: true,
      total: true,
      invoiceDate: true,
      allocations: { select: { amount: true } },
    },
  });
  if (!invoice?.organizationId) {
    return { previousBalance: 0, receivedAmount: 0, currentBalance: invoice?.total ?? 0 };
  }

  const before = new Date(invoice.invoiceDate.getTime() - 1);
  const prior = await accountPosition(invoice.organizationId, before);
  const receivedAmount = invoice.allocations.reduce((s, a) => s + a.amount, 0);

  return {
    previousBalance: prior.outstanding,
    receivedAmount,
    currentBalance: prior.outstanding + invoice.total - receivedAmount,
  };
}
