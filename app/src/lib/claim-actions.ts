"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { audit } from "@/lib/audit";
import { CLAIM_CATEGORIES, ledgerFor, PAYMENT_MODES } from "@/lib/claims";
import { db } from "@/lib/db";
import { getStaff, roleCan } from "@/lib/staff-auth";

/**
 * Expense claims: travel, fuel or food a staff member paid for themselves,
 * sent to an owner to approve. Anyone with a login can claim; only an owner
 * decides, and never on their own claim.
 */

type Result = { ok?: boolean; error?: string };

const claimSchema = z.object({
  spentOn: z.string().min(1, "Pick the date you spent it"),
  /** Rupees as typed. */
  amount: z.number().positive("Enter the amount").max(1_000_000, "Check the amount"),
  category: z.enum(CLAIM_CATEGORIES.map((c) => c.value) as [string, ...string[]], {
    message: "Pick what it was for",
  }),
  paymentMode: z.enum(PAYMENT_MODES.map((m) => m.value) as [string, ...string[]]).optional(),
  note: z.string().trim().min(3, "Say what it was for").max(300),
  billImage: z.string().max(300).nullable().optional(),
});

/** A claim row for the audit trail: JSON has no BigInt. */
const forAudit = <T extends { appUpdatedAt: bigint | null }>(c: T) => ({
  ...c,
  appUpdatedAt: c.appUpdatedAt?.toString() ?? null,
});

function refresh() {
  revalidatePath("/erp/claims");
  revalidatePath("/erp/approvals");
}

export async function submitClaim(input: z.infer<typeof claimSchema>): Promise<Result> {
  const staff = await getStaff();
  if (!staff || staff.breakGlass) return { error: "Sign in with your own account to claim an expense." };
  if (!roleCan(staff.role, "claims.submit")) return { error: "Your role does not claim expenses." };

  const parsed = claimSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const d = parsed.data;

  const spentOn = new Date(d.spentOn);
  if (Number.isNaN(spentOn.getTime())) return { error: "That date is not valid." };
  if (spentOn.getTime() > Date.now() + 24 * 60 * 60 * 1000) return { error: "That date is in the future." };
  // Only a receipt photo uploaded here, never an address from elsewhere
  if (d.billImage && !d.billImage.startsWith("/media/receipt-"))
    return { error: "Upload the bill photo again." };

  // Someone linked to the Team Expenses app gets the claim there too
  const me = await db.adminUser.findUnique({ where: { id: staff.id }, select: { expensesAppName: true } });
  const row = await db.expenseClaim.create({
    data: {
      claimedById: staff.id,
      spentOn,
      amount: Math.round(d.amount * 100),
      category: ledgerFor(d.category) as never,
      appCategory: d.category,
      paymentMode: d.paymentMode ?? null,
      note: d.note,
      billImage: d.billImage || null,
      syncPending: Boolean(me?.expensesAppName),
    },
  });
  await audit({
    action: "claim.create",
    entityType: "ExpenseClaim",
    entityId: row.id,
    after: forAudit(row),
  });
  refresh();
  return { ok: true };
}

const decideSchema = z.object({
  id: z.string().min(1),
  decision: z.enum(["APPROVED", "REJECTED"]),
  reason: z.string().trim().max(300).optional(),
});

export async function decideClaim(input: z.infer<typeof decideSchema>): Promise<Result> {
  const staff = await getStaff();
  if (!staff) return { error: "Sign in again." };
  if (!roleCan(staff.role, "staff.manage")) return { error: "Only an owner approves expense claims." };

  const parsed = decideSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const d = parsed.data;
  if (d.decision === "REJECTED" && (d.reason ?? "").length < 3) {
    return { error: "Say why it is going back, so they can fix it." };
  }

  const claim = await db.expenseClaim.findUnique({
    where: { id: d.id },
    include: { claimedBy: { select: { expensesAppName: true } } },
  });
  if (!claim || claim.status !== "PENDING") return { error: "That claim has already been decided." };
  if (claim.claimedById === staff.id) return { error: "Another owner approves your own claim." };

  const row = await db.expenseClaim.update({
    where: { id: claim.id },
    data: {
      status: d.decision,
      decidedByName: staff.breakGlass ? "Owner" : staff.name,
      decidedAt: new Date(),
      rejectedReason: d.decision === "REJECTED" ? d.reason : null,
      // The decision reaches the Team Expenses app on the next sync
      syncPending: claim.externalId !== null || Boolean(claim.claimedBy.expensesAppName),
    },
  });
  await audit({
    action: d.decision === "APPROVED" ? "claim.approve" : "claim.reject",
    entityType: "ExpenseClaim",
    entityId: row.id,
    before: { status: claim.status },
    after: { status: row.status, reason: row.rejectedReason },
  });
  refresh();
  return { ok: true };
}

/** The person takes back a claim still waiting, or one that was sent back. */
export async function withdrawClaim(id: string): Promise<Result> {
  const staff = await getStaff();
  if (!staff) return { error: "Sign in again." };
  const claim = await db.expenseClaim.findUnique({ where: { id } });
  if (!claim || claim.claimedById !== staff.id) return { error: "That claim is not yours." };
  if (claim.status === "APPROVED" || claim.status === "PAID") return { error: "An approved claim stays on record." };

  // Already in the Team Expenses app: the next sync deletes it there too
  const inApp = claim.externalId !== null && claim.appUpdatedAt !== null;
  await db.$transaction([
    db.expenseClaim.delete({ where: { id } }),
    ...(inApp ? [db.teamExpenseDeletion.create({ data: { externalId: claim.externalId! } })] : []),
  ]);
  await audit({
    action: "claim.withdraw",
    entityType: "ExpenseClaim",
    entityId: id,
    before: forAudit(claim),
  });
  refresh();
  return { ok: true };
}
