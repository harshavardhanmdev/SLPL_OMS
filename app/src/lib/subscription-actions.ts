"use server";

import { randomBytes } from "node:crypto";
import { z } from "zod";

import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { generateOrderNumber, OrderError, RESERVATION_MINUTES } from "@/lib/orders";
import { createRazorpayOrder, isMockPaymentMode, isRazorpayConfigured } from "@/lib/razorpay";
import { endIssueFor, planById, startIssueFor } from "@/lib/subscription-plans";

/**
 * Subscribing to The GenZ Times.
 *
 * Deliberately not the cart: a subscription has no stock to reserve, no
 * coupon and no COD, and it can be bought by someone who has never made an
 * account. Bending checkout to cover it would put the live payment path at
 * risk for nothing.
 */

export type SubscribeResult = {
  error?: string;
  orderNumber?: string;
  code?: string;
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

/** SLPL-S-YYMM-XXXXX, mirroring the order and receipt numbers. */
async function generateSubscriptionCode(): Promise<string> {
  const now = new Date();
  const stamp = `${String(now.getFullYear()).slice(2)}${String(now.getMonth() + 1).padStart(2, "0")}`;
  for (let i = 0; i < 5; i++) {
    const rand = randomBytes(3).toString("hex").toUpperCase().slice(0, 5);
    const candidate = `SLPL-S-${stamp}-${rand}`;
    const clash = await db.subscription.findUnique({ where: { code: candidate } });
    if (!clash) return candidate;
  }
  throw new OrderError("Could not allocate a subscription number - please retry.");
}

const subscribeSchema = z.object({
  planId: z.string().min(1),
  name: z.string().trim().min(2, "Enter the subscriber's name").max(80),
  email: z.string().trim().toLowerCase().email("Enter a valid email"),
  phone: z
    .string()
    .trim()
    .regex(/^[6-9][0-9]{9}$/, "Enter a valid 10-digit mobile number"),
  line1: z.string().trim().min(3, "Enter the address").max(120),
  line2: z.string().trim().max(120).optional().or(z.literal("")),
  city: z.string().trim().min(2, "Enter the city").max(60),
  state: z.string().trim().min(2, "Enter the state").max(60),
  pincode: z.string().regex(/^[1-9][0-9]{5}$/, "Enter a valid 6-digit pincode"),
  /** Honeypot: a real reader never fills this. */
  website: z.string().max(0).optional().or(z.literal("")),
});

export type SubscribeInput = z.infer<typeof subscribeSchema>;

export async function subscribe(input: SubscribeInput): Promise<SubscribeResult> {
  const parsed = subscribeSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const d = parsed.data;
  if (d.website) return { error: "Something went wrong. Please try again." };

  const plan = planById(d.planId);
  if (!plan) return { error: "Pick a subscription plan." };

  const session = await getSession();
  // A subscription can be bought without an account, but the order table needs
  // an owner, so an existing account with this email is linked when there is one.
  const user = session
    ? await db.user.findUnique({ where: { id: session.uid } })
    : await db.user.findUnique({ where: { email: d.email } });
  if (!user) {
    return {
      error: "AUTH_REQUIRED",
    };
  }

  const start = startIssueFor();
  const end = endIssueFor(start.date, plan.issues);
  const code = await generateSubscriptionCode();
  const orderNumber = await generateOrderNumber();

  const order = await db.order.create({
    data: {
      orderNumber,
      userId: user.id,
      status: "AWAITING_PAYMENT",
      paymentMethod: "RAZORPAY",
      subtotal: plan.price,
      discount: 0,
      shippingFee: 0, // posting is inside the subscription price
      total: plan.price,
      shippingAddress: {
        label: "OTHER",
        fullName: d.name,
        phone: d.phone,
        line1: d.line1,
        line2: d.line2 || null,
        landmark: null,
        city: d.city,
        state: d.state,
        pincode: d.pincode,
        lat: null,
        lng: null,
      },
      customerName: d.name,
      customerEmail: d.email,
      customerPhone: d.phone,
      notes: `The GenZ Times, ${plan.label} subscription from ${start.label}`,
      reservedUntil: new Date(Date.now() + RESERVATION_MINUTES * 60 * 1000),
      items: {
        create: [
          {
            title: `The GenZ Times, ${plan.label} subscription (${plan.issues} issues)`,
            unitPrice: plan.price,
            quantity: 1,
          },
        ],
      },
      payment: { create: { provider: "razorpay", status: "CREATED", amount: plan.price } },
      events: { create: { status: "AWAITING_PAYMENT", note: "Subscription started" } },
      subscriptions: {
        create: {
          code,
          userId: user.id,
          subscriberName: d.name,
          email: d.email,
          phone: d.phone,
          addressLine1: d.line1,
          addressLine2: d.line2 || null,
          city: d.city,
          state: d.state,
          pincode: d.pincode,
          termMonths: plan.months,
          issuesTotal: plan.issues,
          amountPaid: plan.price,
          startIssue: start.label,
          endsAt: end.date,
        },
      },
    },
  });

  if (isRazorpayConfigured()) {
    try {
      const rzp = await createRazorpayOrder({ amountPaise: plan.price, receipt: orderNumber });
      await db.payment.update({
        where: { orderId: order.id },
        data: { razorpayOrderId: rzp.id },
      });
      return {
        orderNumber,
        code,
        razorpay: {
          keyId: rzp.keyId,
          rzpOrderId: rzp.id,
          amount: plan.price,
          name: d.name,
          email: d.email,
          contact: d.phone,
        },
      };
    } catch (err) {
      console.error("[razorpay] subscription order failed", err);
      return {
        orderNumber,
        code,
        error: "We could not start the payment - your subscription is saved. Please contact us.",
      };
    }
  }

  if (isMockPaymentMode()) return { orderNumber, code, mock: true };
  return {
    orderNumber,
    code,
    error: "Online payment is not configured yet - please contact us to complete this.",
  };
}
