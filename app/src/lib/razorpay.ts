import "server-only";
import crypto from "node:crypto";
import Razorpay from "razorpay";

/**
 * Razorpay wrapper.
 *
 * - Configured mode: RAZORPAY_KEY_ID + RAZORPAY_KEY_SECRET set (test or live).
 * - Mock mode: keys absent AND ALLOW_MOCK_PAYMENTS=1 - checkout shows a
 *   simulate button so the full order flow works before the owner finishes
 *   Razorpay KYC. Never enable ALLOW_MOCK_PAYMENTS once real keys exist.
 */

export function isRazorpayConfigured(): boolean {
  return Boolean(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET);
}

export function isMockPaymentMode(): boolean {
  return !isRazorpayConfigured() && process.env.ALLOW_MOCK_PAYMENTS === "1";
}

let instance: Razorpay | null = null;
function rzp(): Razorpay {
  if (!instance) {
    instance = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID!,
      key_secret: process.env.RAZORPAY_KEY_SECRET!,
    });
  }
  return instance;
}

export async function createRazorpayOrder(params: {
  amountPaise: number;
  receipt: string;
}): Promise<{ id: string; keyId: string }> {
  const order = await rzp().orders.create({
    amount: params.amountPaise,
    currency: "INR",
    receipt: params.receipt,
    payment_capture: true,
  });
  return { id: order.id, keyId: process.env.RAZORPAY_KEY_ID! };
}

/** Checkout handler returns (order_id, payment_id, signature) - verify HMAC. */
export function verifyCheckoutSignature(params: {
  razorpayOrderId: string;
  razorpayPaymentId: string;
  signature: string;
}): boolean {
  const expected = crypto
    .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET!)
    .update(`${params.razorpayOrderId}|${params.razorpayPaymentId}`)
    .digest("hex");
  return (
    expected.length === params.signature.length &&
    crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(params.signature))
  );
}

/** Webhooks are signed with the separate webhook secret against the raw body. */
export function verifyWebhookSignature(rawBody: string, signature: string): boolean {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!secret) return false;
  const expected = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
  return (
    expected.length === signature.length &&
    crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature))
  );
}

export type RzpPayment = {
  id: string;
  status: "created" | "authorized" | "captured" | "refunded" | "failed";
  method?: string;
  amount: number;
};

export async function fetchPaymentsForOrder(razorpayOrderId: string): Promise<RzpPayment[]> {
  const res = await rzp().orders.fetchPayments(razorpayOrderId);
  return (res.items as unknown as RzpPayment[]) ?? [];
}

export async function refundPayment(paymentId: string, amountPaise?: number): Promise<void> {
  await rzp().payments.refund(paymentId, {
    ...(amountPaise ? { amount: amountPaise } : {}),
    speed: "normal",
  });
}
