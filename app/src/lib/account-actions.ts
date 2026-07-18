"use server";

import { z } from "zod";

import { getSession, createSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { DEFAULT_PREFS, type NotificationPrefs } from "@/lib/notify";

const profileSchema = z.object({
  name: z.string().trim().min(2, "Please enter your name").max(80),
  phone: z
    .string()
    .trim()
    .regex(/^[6-9][0-9]{9}$/, "Enter a valid 10-digit mobile number")
    .optional()
    .or(z.literal("")),
});

export async function updateProfile(input: {
  name: string;
  phone: string;
}): Promise<{ ok?: boolean; error?: string }> {
  const session = await getSession();
  if (!session) return { error: "Please log in again." };
  const parsed = profileSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const user = await db.user.update({
    where: { id: session.uid },
    data: { name: parsed.data.name, phone: parsed.data.phone || null },
  });
  // Refresh the session so the header greeting shows the new name
  await createSession({ uid: user.id, name: user.name, email: user.email });
  return { ok: true };
}

export async function savePrefs(prefs: NotificationPrefs): Promise<{ ok: boolean }> {
  const session = await getSession();
  if (!session) return { ok: false };
  const clean: NotificationPrefs = {
    orderEmails: Boolean(prefs.orderEmails),
    promoEmails: Boolean(prefs.promoEmails),
    orderSms: Boolean(prefs.orderSms),
  };
  await db.user.update({
    where: { id: session.uid },
    data: { notificationPrefs: { ...DEFAULT_PREFS, ...clean } },
  });
  return { ok: true };
}

export async function markNotificationsRead(): Promise<{ ok: boolean }> {
  const session = await getSession();
  if (!session) return { ok: false };
  await db.notification.updateMany({
    where: { userId: session.uid, readAt: null },
    data: { readAt: new Date() },
  });
  return { ok: true };
}

export async function cancelMyOrder(orderNumber: string): Promise<{ ok?: boolean; error?: string }> {
  const session = await getSession();
  if (!session) return { error: "Please log in again." };

  const { restockOrder } = await import("@/lib/orders");
  const { isRazorpayConfigured, refundPayment } = await import("@/lib/razorpay");
  const { renderEmail, sendEmail } = await import("@/lib/email");
  const { formatINR } = await import("@/lib/money");
  const { notifyUser } = await import("@/lib/notify");

  const order = await db.order.findFirst({
    where: { orderNumber, userId: session.uid },
    include: { payment: true, shipment: true },
  });
  if (!order) return { error: "Order not found." };
  if (order.shipment?.awb || ["SHIPPED", "OUT_FOR_DELIVERY", "DELIVERED"].includes(order.status)) {
    return { error: "This order has already shipped. Please use the return process after delivery, or contact us." };
  }
  if (!["AWAITING_PAYMENT", "COD_PENDING_OTP", "PAID", "CONFIRMED", "PROCESSING"].includes(order.status)) {
    return { error: "This order can no longer be cancelled." };
  }

  const wasCaptured = order.payment?.status === "CAPTURED";
  await db.$transaction([
    db.order.update({ where: { id: order.id }, data: { status: "CANCELLED" } }),
    db.orderEvent.create({ data: { orderId: order.id, status: "CANCELLED", note: "Cancelled by customer" } }),
  ]);
  await restockOrder(order.id);

  let refundNote = "";
  if (wasCaptured && order.payment?.razorpayPaymentId && isRazorpayConfigured()) {
    try {
      await refundPayment(order.payment.razorpayPaymentId);
      await db.payment.update({
        where: { orderId: order.id },
        data: { status: "REFUNDED", refundedAmount: order.total },
      });
      await db.orderEvent.create({
        data: { orderId: order.id, status: "REFUNDED", note: "Auto-refund issued on cancellation" },
      });
      refundNote = " Your payment is being refunded and should reach your account in 5-7 working days.";
    } catch (err) {
      console.error("[cancelMyOrder] refund failed", orderNumber, err);
      refundNote = " Your refund is being processed and will reach your account in 5-7 working days.";
      await db.orderEvent.create({
        data: { orderId: order.id, status: "CANCELLED", note: "Refund pending - issue manually from Razorpay dashboard" },
      });
    }
  }

  await sendEmail({
    to: order.customerEmail,
    subject: `Order ${order.orderNumber} cancelled`,
    template: "order-cancelled",
    html: renderEmail(
      "Your order is cancelled",
      `<p>Order <b>${order.orderNumber}</b> (${formatINR(order.total)}) has been cancelled as you requested.${refundNote}</p>`,
    ),
  });
  await notifyUser(
    session.uid,
    "Order cancelled",
    `Order ${order.orderNumber} was cancelled.${refundNote}`,
    `/account/orders/${order.orderNumber}`,
  );
  return { ok: true };
}
