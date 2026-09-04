"use server";

import { z } from "zod";

import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { generateAccessToken, generateReceiptNumber } from "@/lib/kits";
import { createOrderRecord, OrderError, quoteCart, releaseExpiredOrders } from "@/lib/orders";
import { createRazorpayOrder, isMockPaymentMode, isRazorpayConfigured } from "@/lib/razorpay";

/**
 * Buying a school kit for one named student.
 *
 * Deliberately separate from placeOrder: a kit has no delivery address, no
 * coupon, no COD and exactly one line. Bending the live checkout to cover both
 * would put the payment path at risk for no gain.
 */

export type KitOrderResult = {
  error?: string;
  orderNumber?: string;
  razorpay?: {
    keyId: string;
    rzpOrderId: string;
    amount: number;
    name: string;
    email: string;
    contact: string;
  };
  mock?: boolean;
};

const kitOrderSchema = z.object({
  schoolKitId: z.string().min(1),
  studentId: z.string().min(1).optional(),
  studentName: z.string().trim().min(2, "Enter the student's full name").max(80).optional(),
  section: z.string().trim().max(8).optional(),
  rollNumber: z.string().trim().max(20).optional(),
  guardianPhone: z
    .string()
    .trim()
    .regex(/^[6-9][0-9]{9}$/, "Enter a valid 10-digit mobile number"),
});

export type KitOrderInput = z.infer<typeof kitOrderSchema>;

/** Roster lookup for the picker. Never returns a whole class in one go. */
export async function searchStudents(
  schoolKitId: string,
  query: string,
): Promise<{ id: string; fullName: string; section: string; rollNumber: string }[]> {
  const term = query.trim();
  if (term.length < 2) return [];
  const kit = await db.schoolKit.findUnique({
    where: { id: schoolKitId },
    select: { schoolId: true, classLabel: true },
  });
  if (!kit) return [];

  return db.student.findMany({
    where: {
      schoolId: kit.schoolId,
      classLabel: kit.classLabel,
      isActive: true,
      OR: [
        { fullName: { contains: term, mode: "insensitive" } },
        { rollNumber: { equals: term, mode: "insensitive" } },
      ],
    },
    select: { id: true, fullName: true, section: true, rollNumber: true },
    orderBy: [{ section: "asc" }, { rollNumber: "asc" }],
    take: 12,
  });
}

export async function placeKitOrder(input: KitOrderInput): Promise<KitOrderResult> {
  const session = await getSession();
  if (!session) return { error: "AUTH" };

  const parsed = kitOrderSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const d = parsed.data;

  const kit = await db.schoolKit.findFirst({
    where: { id: d.schoolKitId, isActive: true, school: { isActive: true } },
    include: {
      school: { select: { name: true, isActive: true } },
      product: { select: { id: true, title: true, isVisible: true } },
    },
  });
  if (!kit) return { error: "This kit is not available right now." };
  if (!kit.product.isVisible) return { error: "This kit is not on sale right now." };

  // Identify the student: from the roster where we have one, typed in otherwise
  let studentId: string | null = null;
  let studentName: string;
  let section: string;
  let rollNumber: string | null = null;

  if (d.studentId) {
    const student = await db.student.findFirst({
      where: {
        id: d.studentId,
        schoolId: kit.schoolId,
        classLabel: kit.classLabel,
        isActive: true,
      },
    });
    if (!student) return { error: "Pick the student again - that record has changed." };
    studentId = student.id;
    studentName = student.fullName;
    section = student.section;
    rollNumber = student.rollNumber;
  } else {
    if (!d.studentName) return { error: "Enter the student's full name." };
    studentName = d.studentName;
    section = d.section?.toUpperCase() || "A";
    rollNumber = d.rollNumber || null;
  }

  // One kit per student per year. A cancelled purchase frees the student, and
  // so does an abandoned payment: the receipt stays PENDING so a late webhook
  // can still complete it, but a dead order must not lock the child out.
  const existing = await db.kitPurchase.findFirst({
    where: {
      schoolKitId: kit.id,
      status: { in: ["PENDING", "PAID", "READY", "COLLECTED"] },
      order: { status: { notIn: ["EXPIRED", "PAYMENT_FAILED", "CANCELLED", "REFUNDED"] } },
      ...(studentId ? { studentId } : { studentName, section }),
    },
    select: { receiptNumber: true, status: true },
  });
  if (existing) {
    return {
      error:
        existing.status === "PENDING"
          ? `A payment for ${studentName} is already in progress (${existing.receiptNumber}). Check My orders before paying again.`
          : `The kit for ${studentName} is already paid for (receipt ${existing.receiptNumber}).`,
    };
  }

  await releaseExpiredOrders();

  let quote;
  try {
    quote = await quoteCart([{ productId: kit.productId, quantity: 1 }]);
  } catch (err) {
    if (err instanceof OrderError) return { error: err.message };
    throw err;
  }

  const user = await db.user.findUnique({ where: { id: session.uid } });
  if (!user) return { error: "Please log in again." };

  const receiptNumber = await generateReceiptNumber();
  const { orderId, orderNumber } = await createOrderRecord({
    userId: session.uid,
    quote,
    // Nothing is couriered, but the address column is the snapshot every order
    // screen and email already reads, so it carries the collection point.
    address: {
      label: "OTHER",
      fullName: user.name,
      phone: d.guardianPhone,
      line1: `Collect at ${kit.school.name}`,
      line2: `${kit.classLabel} ${section}, ${studentName}`,
      landmark: null,
      city: "-",
      state: "-",
      pincode: "-",
      lat: null,
      lng: null,
    },
    customer: { name: user.name, email: user.email, phone: d.guardianPhone },
    method: "RAZORPAY",
    fulfilment: "COLLECT_AT_SCHOOL",
    kitPurchase: {
      receiptNumber,
      accessToken: generateAccessToken(),
      schoolKit: { connect: { id: kit.id } },
      ...(studentId ? { student: { connect: { id: studentId } } } : {}),
      studentName,
      classLabel: kit.classLabel,
      section,
      rollNumber,
      schoolName: kit.school.name,
      kitTitle: kit.product.title,
      amountPaid: quote.total,
    },
  });

  if (isRazorpayConfigured()) {
    try {
      const rzpOrder = await createRazorpayOrder({ amountPaise: quote.total, receipt: orderNumber });
      await db.payment.update({
        where: { orderId },
        data: { razorpayOrderId: rzpOrder.id },
      });
      return {
        orderNumber,
        razorpay: {
          keyId: rzpOrder.keyId,
          rzpOrderId: rzpOrder.id,
          amount: quote.total,
          name: user.name,
          email: user.email,
          contact: d.guardianPhone,
        },
      };
    } catch (err) {
      console.error("[razorpay] kit order create failed", err);
      return {
        orderNumber,
        error:
          "We could not start the payment - the kit order is saved. Open it from My Orders to retry.",
      };
    }
  }

  if (isMockPaymentMode()) return { orderNumber, mock: true };

  return {
    orderNumber,
    error: "Online payment is not configured yet - please contact us to complete this order.",
  };
}
