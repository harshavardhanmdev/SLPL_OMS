import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { markOrderPaid, markPaymentFailed } from "@/lib/orders";
import { verifyWebhookSignature } from "@/lib/razorpay";

/**
 * Razorpay webhook receiver - the authoritative confirmation channel.
 * Idempotent via the x-razorpay-event-id header stored on PaymentEvent.
 * Enable events in the Razorpay dashboard: payment.captured, payment.failed, order.paid.
 */
export async function POST(request: Request) {
  const rawBody = await request.text();
  const signature = request.headers.get("x-razorpay-signature") ?? "";
  if (!verifyWebhookSignature(rawBody, signature)) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const eventId = request.headers.get("x-razorpay-event-id") ?? `no-id-${Date.now()}`;
  type WebhookBody = {
    event: string;
    payload?: { payment?: { entity?: { id: string; order_id: string; method?: string; error_description?: string } } };
  };
  let body: WebhookBody;
  try {
    body = JSON.parse(rawBody) as WebhookBody;
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const entity = body.payload?.payment?.entity;
  const rzpOrderId = entity?.order_id;
  if (!rzpOrderId) return NextResponse.json({ ok: true }); // event we don't track

  const payment = await db.payment.findUnique({
    where: { razorpayOrderId: rzpOrderId },
  });
  if (!payment) return NextResponse.json({ ok: true }); // not ours

  // Dedupe retries
  const existing = await db.paymentEvent.findUnique({ where: { eventId } });
  if (existing) return NextResponse.json({ ok: true });
  await db.paymentEvent.create({
    data: {
      paymentId: payment.id,
      eventId,
      type: body.event,
      payload: JSON.parse(rawBody),
    },
  });

  switch (body.event) {
    case "payment.captured":
    case "order.paid":
      await markOrderPaid(payment.orderId, {
        razorpayPaymentId: entity!.id,
        method: entity!.method,
        via: "webhook",
      });
      break;
    case "payment.failed":
      await markPaymentFailed(
        payment.orderId,
        entity?.error_description ?? "Payment failed (webhook)",
      );
      break;
  }

  return NextResponse.json({ ok: true });
}
