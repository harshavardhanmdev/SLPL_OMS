"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { audit } from "@/lib/audit";
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
  category: z.enum(["TRAVEL", "FUEL", "MEALS", "MISC"], {
    message: "Pick what it was for",
  }),
  note: z.string().trim().min(3, "Say what it was for").max(300),
  billImage: z.string().max(300).nullable().optional(),
});

function refresh() {
  revalidatePath("/erp/claims");
  revalidatePath("/erp/approvals");
}

export async function submitClaim(input: z.infer<typeof claimSchema>): Promise<Result> {
  const staff = await getStaff();
  if (!staff || staff.breakGlass) return { error: "Sign in with your own account to claim an expense." };

  const parsed = claimSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const d = parsed.data;

  const spentOn = new Date(d.spentOn);
  if (Number.isNaN(spentOn.getTime())) return { error: "That date is not valid." };
  if (spentOn.getTime() > Date.now() + 24 * 60 * 60 * 1000) return { error: "That date is in the future." };
  // Only a receipt photo uploaded here, never an address from elsewhere
  if (d.billImage && !d.billImage.startsWith("/media/receipt-"))
    return { error: "Upload the bill photo again." };

  const row = await db.expenseClaim.create({
    data: {
      claimedById: staff.id,
      spentOn,
      amount: Math.round(d.amount * 100),
      category: d.category,
      note: d.note,
      billImage: d.billImage || null,
    },
  });
  await audit({
    action: "claim.create",
    entityType: "ExpenseClaim",
    entityId: row.id,
    after: row,
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

  const claim = await db.expenseClaim.findUnique({ where: { id: d.id } });
  if (!claim || claim.status !== "PENDING") return { error: "That claim has already been decided." };
  if (claim.claimedById === staff.id) return { error: "Another owner approves your own claim." };

  const row = await db.expenseClaim.update({
    where: { id: claim.id },
    data: {
      status: d.decision,
      decidedByName: staff.breakGlass ? "Owner" : staff.name,
      decidedAt: new Date(),
      rejectedReason: d.decision === "REJECTED" ? d.reason : null,
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
  if (claim.status === "APPROVED") return { error: "An approved claim stays on record." };

  await db.expenseClaim.delete({ where: { id } });
  await audit({
    action: "claim.withdraw",
    entityType: "ExpenseClaim",
    entityId: id,
    before: claim,
  });
  refresh();
  return { ok: true };
}
