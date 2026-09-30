"use server";

import { z } from "zod";

import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { generateOrderNumber } from "@/lib/orders";
import { createRazorpayOrder, isMockPaymentMode, isRazorpayConfigured } from "@/lib/razorpay";

/**
 * Buying a digital edition.
 *
 * Deliberately not the cart, for the same reason kits and subscriptions are
 * not: there is no address, no coupon, no COD, no stock and exactly one line.
 * Bending the live checkout to cover it would put the payment path at risk for
 * nothing.
 */

export type BuyDigitalResult = {
  error?: string;
  alreadyOwned?: boolean;
  readHref?: string;
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

const schema = z.object({ slug: z.string().min(1).max(120) });

export async function buyDigitalEdition(input: { slug: string }): Promise<BuyDigitalResult> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { error: "That edition does not exist." };

  // The licence is attached to an account, so there has to be one signed in
  const session = await getSession();
  if (!session) return { error: "AUTH_REQUIRED" };
  const user = await db.user.findUnique({ where: { id: session.uid } });
  if (!user) return { error: "AUTH_REQUIRED" };

  const product = await db.product.findFirst({
    where: { slug: parsed.data.slug, kind: "DIGITAL", isVisible: true },
  });
  if (!product) return { error: "That edition is not on sale." };
  if (!product.editionKey || !product.pageCount) {
    return { error: "That edition is not ready to read yet. Please try later." };
  }

  const readHref = `/read/${product.slug}`;
  const owned = await db.digitalEntitlement.findUnique({
    where: { userId_productId: { userId: user.id, productId: product.id } },
  });
  if (owned && !owned.revokedAt) return { alreadyOwned: true, readHref };

  const price = product.salePrice ?? product.price;
  const orderNumber = await generateOrderNumber();

  const order = await db.order.create({
    data: {
      orderNumber,
      userId: user.id,
      status: "AWAITING_PAYMENT",
      paymentMethod: "RAZORPAY",
      subtotal: price,
      discount: 0,
      shippingFee: 0, // nothing is posted
      total: price,
      // Nothing is couriered, but the address column is the snapshot every
      // order screen and email already reads, so it carries what this is.
      shippingAddress: {
        label: "OTHER",
        fullName: user.name,
        phone: user.phone ?? "",
        line1: "Digital edition, read online",
        line2: product.title,
        landmark: null,
        city: "-",
        state: "-",
        pincode: "-",
        lat: null,
        lng: null,
      },
      customerName: user.name,
      customerEmail: user.email,
      customerPhone: user.phone ?? "",
      notes: `Digital edition: ${product.title}`,
      // Deliberately no reservedUntil. A digital edition holds no stock, and a
      // reservation on a stockless order gets swept to EXPIRED and then has its
      // payment auto-refunded by reconciliation.
      reservedUntil: null,
      items: {
        create: [
          {
            productId: product.id,
            title: product.title,
            unitPrice: price,
            quantity: 1,
            image: product.coverImage,
          },
        ],
      },
      payment: { create: { provider: "razorpay", status: "CREATED", amount: price } },
      events: { create: { status: "AWAITING_PAYMENT", note: "Digital edition ordered" } },
    },
  });

  if (isRazorpayConfigured()) {
    try {
      const rzp = await createRazorpayOrder({ amountPaise: price, receipt: orderNumber });
      await db.payment.update({
        where: { orderId: order.id },
        data: { razorpayOrderId: rzp.id },
      });
      return {
        orderNumber,
        readHref,
        razorpay: {
          keyId: rzp.keyId,
          rzpOrderId: rzp.id,
          amount: price,
          name: user.name,
          email: user.email,
          contact: user.phone ?? "",
        },
      };
    } catch (err) {
      console.error("[razorpay] digital order failed", err);
      return {
        orderNumber,
        error: "We could not start the payment. Nothing has been charged, please try again.",
      };
    }
  }

  if (isMockPaymentMode()) return { orderNumber, readHref, mock: true };
  return { orderNumber, error: "Online payment is not configured yet." };
}
