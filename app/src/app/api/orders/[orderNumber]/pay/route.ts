import { NextResponse } from "next/server";

import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { isRazorpayConfigured } from "@/lib/razorpay";

/**
 * Resume payment for an order stuck in AWAITING_PAYMENT (closed modal,
 * expired QR, network drop). Reuses the original Razorpay order id, so the
 * amount and webhook wiring stay identical.
 */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ orderNumber: string }> },
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Please log in again." }, { status: 401 });
  if (!isRazorpayConfigured()) {
    return NextResponse.json({ error: "Online payment is not available right now." }, { status: 503 });
  }

  const { orderNumber } = await params;
  const order = await db.order.findFirst({
    where: { orderNumber, userId: session.uid },
    include: { payment: true, user: { select: { name: true, email: true } } },
  });
  if (!order) return NextResponse.json({ error: "Order not found." }, { status: 404 });
  if (order.status !== "AWAITING_PAYMENT") {
    return NextResponse.json({ error: "This order is not awaiting payment." }, { status: 409 });
  }
  if (!order.payment?.razorpayOrderId) {
    return NextResponse.json({ error: "No payment session exists for this order." }, { status: 409 });
  }
  if (order.reservedUntil && order.reservedUntil < new Date()) {
    return NextResponse.json(
      { error: "The reservation for this order has expired. Please add the items to your cart and order again." },
      { status: 410 },
    );
  }

  const addr = order.shippingAddress as { phone?: string };
  return NextResponse.json({
    keyId: process.env.RAZORPAY_KEY_ID,
    rzpOrderId: order.payment.razorpayOrderId,
    amount: order.total,
    name: order.user.name,
    email: order.user.email,
    contact: addr.phone ?? order.customerPhone,
  });
}
