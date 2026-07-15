"use server";

import { SignJWT, jwtVerify } from "jose";
import { z } from "zod";

import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { issueOtp, verifyOtp } from "@/lib/otp";
import {
  createOrderRecord,
  OrderError,
  quoteCart,
  releaseExpiredOrders,
  type CartLineInput,
  type Quote,
} from "@/lib/orders";
import { confirmCodOrder } from "@/lib/orders";
import { createRazorpayOrder, isMockPaymentMode, isRazorpayConfigured } from "@/lib/razorpay";

const linesSchema = z
  .array(z.object({ productId: z.string().min(1), quantity: z.number().int().min(1).max(99) }))
  .min(1)
  .max(50);

// ── Addresses ────────────────────────────────────────────────────────────────

const addressSchema = z.object({
  label: z.enum(["HOME", "OFFICE", "OTHER"]),
  fullName: z.string().trim().min(2).max(80),
  phone: z.string().trim().regex(/^[6-9][0-9]{9}$/, "Enter a valid 10-digit mobile number"),
  line1: z.string().trim().min(3).max(120),
  line2: z.string().trim().max(120).optional().or(z.literal("")),
  landmark: z.string().trim().max(120).optional().or(z.literal("")),
  city: z.string().trim().min(2).max(60),
  state: z.string().trim().min(2).max(60),
  pincode: z.string().regex(/^[1-9][0-9]{5}$/, "Enter a valid 6-digit pincode"),
  lat: z.number().min(6).max(38).optional().nullable(),
  lng: z.number().min(68).max(98).optional().nullable(),
  isDefault: z.boolean().optional(),
});

export type AddressInput = z.infer<typeof addressSchema>;

export async function saveAddress(input: AddressInput): Promise<{ id?: string; error?: string }> {
  const session = await getSession();
  if (!session) return { error: "Please log in again." };
  const parsed = addressSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const data = {
    ...parsed.data,
    line2: parsed.data.line2 || null,
    landmark: parsed.data.landmark || null,
    lat: parsed.data.lat ?? null,
    lng: parsed.data.lng ?? null,
    userId: session.uid,
    isDefault: parsed.data.isDefault ?? false,
  };
  if (data.isDefault) {
    await db.address.updateMany({ where: { userId: session.uid }, data: { isDefault: false } });
  }
  const row = await db.address.create({ data });
  return { id: row.id };
}

export async function deleteAddress(id: string): Promise<void> {
  const session = await getSession();
  if (!session) return;
  await db.address.deleteMany({ where: { id, userId: session.uid } });
}

export async function listAddresses() {
  const session = await getSession();
  if (!session) return [];
  return db.address.findMany({
    where: { userId: session.uid },
    orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
  });
}

// ── Quote ────────────────────────────────────────────────────────────────────

export type QuoteResult = { quote?: Quote; error?: string };

export async function getQuote(
  lines: CartLineInput[],
  couponCode?: string | null,
  pincode?: string | null,
): Promise<QuoteResult> {
  const session = await getSession();
  if (!session) return { error: "AUTH" };
  const parsed = linesSchema.safeParse(lines);
  if (!parsed.success) return { error: "Your cart looks invalid - refresh and try again." };
  try {
    // Opportunistic cleanup keeps stock honest even if the worker is down
    await releaseExpiredOrders();
    return { quote: await quoteCart(parsed.data, couponCode, pincode) };
  } catch (err) {
    if (err instanceof OrderError) return { error: err.message };
    throw err;
  }
}

// ── Bulk-order OTP gate ──────────────────────────────────────────────────────

function otpSecret() {
  return new TextEncoder().encode(process.env.SESSION_SECRET!);
}

export async function requestBulkOtp(): Promise<{ ok: boolean; error?: string }> {
  const session = await getSession();
  if (!session) return { ok: false, error: "Please log in again." };
  const sent = await issueOtp(session.email, "BULK_ORDER");
  return sent
    ? { ok: true }
    : { ok: false, error: "Too many codes requested - try again in an hour." };
}

export async function verifyBulkOtp(code: string): Promise<{ token?: string; error?: string }> {
  const session = await getSession();
  if (!session) return { error: "Please log in again." };
  const res = await verifyOtp(session.email, "BULK_ORDER", code);
  if (!res.ok) return { error: res.error };
  const token = await new SignJWT({ email: session.email, purpose: "BULK_ORDER" })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("15m")
    .sign(otpSecret());
  return { token };
}

async function bulkTokenValid(token: string | undefined, email: string): Promise<boolean> {
  if (!token) return false;
  try {
    const { payload } = await jwtVerify(token, otpSecret());
    return payload.email === email && payload.purpose === "BULK_ORDER";
  } catch {
    return false;
  }
}

// ── Place order ──────────────────────────────────────────────────────────────

export type PlaceOrderResult = {
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
  codOtpSent?: boolean;
};

export async function placeOrder(input: {
  lines: CartLineInput[];
  couponCode?: string | null;
  addressId: string;
  method: "RAZORPAY" | "COD";
  bulkToken?: string;
  notes?: string;
}): Promise<PlaceOrderResult> {
  const session = await getSession();
  if (!session) return { error: "AUTH" };

  const parsedLines = linesSchema.safeParse(input.lines);
  if (!parsedLines.success) return { error: "Your cart looks invalid - refresh and try again." };

  const address = await db.address.findFirst({
    where: { id: input.addressId, userId: session.uid },
  });
  if (!address) return { error: "Pick a delivery address." };

  let quote: Quote;
  try {
    quote = await quoteCart(parsedLines.data, input.couponCode, address.pincode);
  } catch (err) {
    if (err instanceof OrderError) return { error: err.message };
    throw err;
  }

  if (quote.contactRequired) {
    return {
      error:
        "Orders of this size are handled personally - please contact us on +91 79891 91962 (call/WhatsApp) for institutional pricing and secure delivery.",
    };
  }
  if (input.method === "COD" && !quote.codAllowed) {
    return { error: "Cash on Delivery is not available for this order value - please pay online." };
  }
  if (quote.otpRequired && !(await bulkTokenValid(input.bulkToken, session.email))) {
    return { error: "BULK_OTP_REQUIRED" };
  }

  const user = await db.user.findUnique({ where: { id: session.uid } });
  if (!user) return { error: "Please log in again." };

  const { orderId, orderNumber } = await createOrderRecord({
    userId: session.uid,
    quote,
    address: {
      label: address.label,
      fullName: address.fullName,
      phone: address.phone,
      line1: address.line1,
      line2: address.line2,
      landmark: address.landmark,
      city: address.city,
      state: address.state,
      pincode: address.pincode,
      lat: address.lat,
      lng: address.lng,
    },
    customer: { name: user.name, email: user.email, phone: address.phone },
    method: input.method,
    notes: input.notes?.slice(0, 500),
  });

  if (input.method === "COD") {
    await issueOtp(user.email, "COD_CONFIRM");
    return { orderNumber, codOtpSent: true };
  }

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
          contact: address.phone,
        },
      };
    } catch (err) {
      console.error("[razorpay] order create failed", err);
      return {
        orderNumber,
        error:
          "We could not start the payment - your order is saved. Open it from My Orders to retry.",
      };
    }
  }

  if (isMockPaymentMode()) {
    return { orderNumber, mock: true };
  }

  return {
    orderNumber,
    error:
      "Online payment is not configured yet - your order is saved as pending. Please contact us to complete it.",
  };
}

export async function confirmCod(
  orderNumber: string,
  code: string,
): Promise<{ ok: boolean; error?: string }> {
  const session = await getSession();
  if (!session) return { ok: false, error: "Please log in again." };
  const order = await db.order.findFirst({
    where: { orderNumber, userId: session.uid, status: "COD_PENDING_OTP" },
  });
  if (!order) return { ok: false, error: "This order is not awaiting confirmation." };

  const res = await verifyOtp(order.customerEmail, "COD_CONFIRM", code);
  if (!res.ok) return { ok: false, error: res.error };

  await confirmCodOrder(order.id);
  return { ok: true };
}

export async function resendCodOtp(orderNumber: string): Promise<{ ok: boolean; error?: string }> {
  const session = await getSession();
  if (!session) return { ok: false, error: "Please log in again." };
  const order = await db.order.findFirst({
    where: { orderNumber, userId: session.uid, status: "COD_PENDING_OTP" },
  });
  if (!order) return { ok: false, error: "This order is not awaiting confirmation." };
  const sent = await issueOtp(order.customerEmail, "COD_CONFIRM");
  return sent ? { ok: true } : { ok: false, error: "Too many codes requested - try later." };
}
