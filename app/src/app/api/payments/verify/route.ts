import { NextResponse } from "next/server";
import { z } from "zod";

import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { markOrderPaid, markPaymentFailed } from "@/lib/orders";
import { isMockPaymentMode, verifyCheckoutSignature } from "@/lib/razorpay";

const realSchema = z.object({
  orderNumber: z.string().min(1),
  razorpay_order_id: z.string().min(1),
  razorpay_payment_id: z.string().min(1),
  razorpay_signature: z.string().min(1),
});

const mockSchema = z.object({
  orderNumber: z.string().min(1),
  mock: z.literal(true),
  outcome: z.enum(["success", "failure"]),
});

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ ok: false }, { status: 401 });

  const body = await request.json().catch(() => null);

  // ── Mock mode (pre-KYC demos only; gated by ALLOW_MOCK_PAYMENTS=1) ──
  const mock = mockSchema.safeParse(body);
  if (mock.success) {
    if (!isMockPaymentMode()) return NextResponse.json({ ok: false }, { status: 403 });
    const order = await db.order.findFirst({
      where: { orderNumber: mock.data.orderNumber, userId: session.uid },
    });
    if (!order) return NextResponse.json({ ok: false }, { status: 404 });
    if (mock.data.outcome === "success") {
      await markOrderPaid(order.id, { via: "mock-payment", method: "mock" });
    } else {
      await markPaymentFailed(order.id, "Simulated failure (mock mode)");
    }
    return NextResponse.json({ ok: true });
  }

  // ── Real Razorpay checkout callback ──
  const parsed = realSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ ok: false }, { status: 400 });

  const order = await db.order.findFirst({
    where: { orderNumber: parsed.data.orderNumber, userId: session.uid },
    include: { payment: true },
  });
  if (!order || order.payment?.razorpayOrderId !== parsed.data.razorpay_order_id) {
    return NextResponse.json({ ok: false }, { status: 404 });
  }

  const valid = verifyCheckoutSignature({
    razorpayOrderId: parsed.data.razorpay_order_id,
    razorpayPaymentId: parsed.data.razorpay_payment_id,
    signature: parsed.data.razorpay_signature,
  });
  if (!valid) {
    return NextResponse.json({ ok: false, error: "Signature mismatch" }, { status: 400 });
  }

  await markOrderPaid(order.id, {
    razorpayPaymentId: parsed.data.razorpay_payment_id,
    via: "checkout-callback",
  });
  return NextResponse.json({ ok: true });
}
