"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { db } from "@/lib/db";
import {
  checkSchoolPin,
  createStaffSession,
  destroyStaffSession,
  getStaffSession,
} from "@/lib/kit-staff-auth";

/** What school staff can do: sign in, look a receipt up, hand the kit over. */

type Result = { ok?: boolean; error?: string };

const loginSchema = z.object({
  code: z.string().trim().min(2, "Enter your school code").max(20),
  pin: z.string().trim().min(4, "Enter the PIN").max(20),
  staffName: z.string().trim().min(2, "Enter your name").max(60),
});

export async function schoolStaffLogin(input: {
  code: string;
  pin: string;
  staffName: string;
}): Promise<Result> {
  const parsed = loginSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const school = await checkSchoolPin(parsed.data.code, parsed.data.pin);
  if (!school) return { error: "That school code and PIN do not match." };

  await createStaffSession({
    schoolId: school.id,
    schoolName: school.name,
    staffName: parsed.data.staffName,
  });
  return { ok: true };
}

export async function schoolStaffLogout(): Promise<void> {
  await destroyStaffSession();
  revalidatePath("/kits/verify");
}

export type LookupResult = {
  error?: string;
  purchase?: {
    accessToken: string;
    receiptNumber: string;
    studentName: string;
    classLabel: string;
    section: string;
    rollNumber: string | null;
    kitTitle: string;
    status: string;
    collectedAt: string | null;
    collectedBy: string | null;
  };
};

/** Manual fallback for when a QR will not scan: type the receipt number. */
export async function lookupReceipt(receiptNumber: string): Promise<LookupResult> {
  const staff = await getStaffSession();
  if (!staff) return { error: "Please sign in again." };

  const purchase = await db.kitPurchase.findFirst({
    where: {
      receiptNumber: receiptNumber.trim().toUpperCase(),
      schoolKit: { schoolId: staff.schoolId },
    },
    include: { schoolKit: { select: { schoolId: true } } },
  });
  if (!purchase) return { error: "No kit receipt with that number at your school." };

  return {
    purchase: {
      accessToken: purchase.accessToken,
      receiptNumber: purchase.receiptNumber,
      studentName: purchase.studentName,
      classLabel: purchase.classLabel,
      section: purchase.section,
      rollNumber: purchase.rollNumber,
      kitTitle: purchase.kitTitle,
      status: purchase.status,
      collectedAt: purchase.collectedAt?.toISOString() ?? null,
      collectedBy: purchase.collectedBy,
    },
  };
}

/**
 * Hand the kit over. Guarded so a second scan of the same receipt cannot
 * produce a second kit, and so one school cannot release another's.
 */
export async function markCollected(accessToken: string): Promise<Result> {
  const staff = await getStaffSession();
  if (!staff) return { error: "Please sign in again." };

  const purchase = await db.kitPurchase.findUnique({
    where: { accessToken },
    include: { schoolKit: { select: { schoolId: true } } },
  });
  if (!purchase) return { error: "That receipt does not exist." };
  if (purchase.schoolKit.schoolId !== staff.schoolId) {
    return { error: "This receipt belongs to another school." };
  }
  if (purchase.status === "COLLECTED") {
    const when = purchase.collectedAt?.toLocaleString("en-IN", {
      day: "numeric",
      month: "short",
      hour: "numeric",
      minute: "2-digit",
    });
    return {
      error: `Already collected on ${when}${purchase.collectedBy ? ` by ${purchase.collectedBy}` : ""}. Do not hand over a second kit.`,
    };
  }
  if (purchase.status === "CANCELLED") return { error: "This purchase was cancelled." };
  if (purchase.status === "PENDING") return { error: "Payment for this kit has not come through." };

  const res = await db.kitPurchase.updateMany({
    where: { id: purchase.id, status: { in: ["PAID", "READY"] } },
    data: { status: "COLLECTED", collectedAt: new Date(), collectedBy: staff.staffName },
  });
  if (res.count === 0) return { error: "Someone just marked this collected. Refresh the page." };

  await db.kitCollectionEvent.create({
    data: {
      purchaseId: purchase.id,
      status: "COLLECTED",
      note: `Handed over by ${staff.staffName}`,
      bySchoolStaff: true,
    },
  });
  revalidatePath(`/kits/receipt/${accessToken}`);
  return { ok: true };
}
