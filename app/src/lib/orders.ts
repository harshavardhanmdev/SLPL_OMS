import "server-only";
import { randomBytes } from "node:crypto";

import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { getActiveSale, getSetting } from "@/lib/catalog";
import { effectivePrice } from "@/lib/pricing";
import { estimateDelivery } from "@/lib/shipping/estimate";
import { renderEmail, sendEmail, notifyOwner } from "@/lib/email";
import { getPrefs, notifyUser } from "@/lib/notify";
import { sendSms } from "@/lib/sms";
import { formatINR } from "@/lib/money";
import { emailKitReceipt } from "@/lib/kit-notify";
import { activateSubscriptions } from "@/lib/subscription-notify";
import { StockError, releaseStock, reserveStock } from "@/lib/stock";
import {
  fetchPaymentsForOrder,
  isRazorpayConfigured,
  refundPayment,
} from "@/lib/razorpay";

export const RESERVATION_MINUTES = 30;

export type CartLineInput = { productId: string; quantity: number };

export type QuoteItem = {
  productId: string;
  slug: string;
  title: string;
  unitPrice: number;
  quantity: number;
  image: string | null;
  weightGrams: number;
};

export type Quote = {
  items: QuoteItem[];
  subtotal: number;
  discount: number;
  couponCode: string | null;
  couponError: string | null;
  shippingFee: number;
  total: number;
  weightGrams: number;
  codAllowed: boolean;
  otpRequired: boolean;
  contactRequired: boolean;
  etaDaysMin: number | null;
  etaDaysMax: number | null;
};

export class OrderError extends Error {}

export async function quoteCart(
  lines: CartLineInput[],
  couponCode?: string | null,
  pincode?: string | null,
): Promise<Quote> {
  if (lines.length === 0) throw new OrderError("Your cart is empty.");
  if (lines.length > 50) throw new OrderError("Too many distinct items in one order.");

  const sale = await getActiveSale();
  const products = await db.product.findMany({
    where: { id: { in: lines.map((l) => l.productId) }, isVisible: true },
  });
  const bySlug = new Map(products.map((p) => [p.id, p]));

  const items: QuoteItem[] = [];
  for (const line of lines) {
    const p = bySlug.get(line.productId);
    if (!p) continue; // silently drop products that vanished
    const quantity = Math.min(Math.max(1, line.quantity), 99);
    if (p.stock < quantity) {
      throw new OrderError(
        p.stock === 0
          ? `“${p.title}” just went out of stock.`
          : `Only ${p.stock} left of “${p.title}” - reduce the quantity.`,
      );
    }
    items.push({
      productId: p.id,
      slug: p.slug,
      title: p.title,
      unitPrice: effectivePrice(p, sale),
      quantity,
      image: p.coverImage,
      weightGrams: p.weightGrams,
    });
  }
  if (items.length === 0) throw new OrderError("None of the cart items are available any more.");

  const subtotal = items.reduce((s, i) => s + i.unitPrice * i.quantity, 0);

  // Coupon
  let discount = 0;
  let appliedCoupon: string | null = null;
  let couponError: string | null = null;
  const code = couponCode?.trim().toUpperCase();
  if (code) {
    const now = new Date();
    const coupon = await db.coupon.findUnique({ where: { code } });
    if (
      !coupon ||
      !coupon.isActive ||
      (coupon.startsAt && now < coupon.startsAt) ||
      (coupon.endsAt && now > coupon.endsAt) ||
      (coupon.usageLimit != null && coupon.usedCount >= coupon.usageLimit)
    ) {
      couponError = "This coupon code is not valid.";
    } else if (subtotal < coupon.minOrder) {
      couponError = `This coupon needs a minimum order of ${formatINR(coupon.minOrder)}.`;
    } else {
      discount =
        coupon.type === "PERCENT"
          ? Math.round((subtotal * coupon.value) / 100)
          : coupon.value;
      if (coupon.maxDiscount != null) discount = Math.min(discount, coupon.maxDiscount);
      discount = Math.min(discount, subtotal - 100); // keep at least ₹1 payable
      appliedCoupon = coupon.code;
    }
  }

  const weightGrams = items.reduce((s, i) => s + i.weightGrams * i.quantity, 0);
  const discounted = subtotal - discount;

  let shippingFee: number;
  let etaDaysMin: number | null = null;
  let etaDaysMax: number | null = null;
  const quote = pincode ? await estimateDelivery(pincode, weightGrams, discounted) : null;
  if (quote) {
    shippingFee = quote.charge;
    etaDaysMin = quote.etaDaysMin;
    etaDaysMax = quote.etaDaysMax;
  } else {
    const [flatFee, freeThreshold] = await Promise.all([
      getSetting<number>("shipping_flat_fee", 6000),
      getSetting<number>("free_shipping_threshold", 0),
    ]);
    shippingFee = freeThreshold > 0 && discounted >= freeThreshold ? 0 : flatFee;
  }

  const total = discounted + shippingFee;

  const [codMax, bulkOtp, contactAbove] = await Promise.all([
    getSetting<number>("cod_max_order_value", 150000),
    getSetting<number>("bulk_otp_threshold", 500000),
    getSetting<number>("contact_us_threshold", 2000000),
  ]);

  return {
    items,
    subtotal,
    discount,
    couponCode: appliedCoupon,
    couponError,
    shippingFee,
    total,
    weightGrams,
    codAllowed: total <= codMax,
    otpRequired: total >= bulkOtp,
    contactRequired: total >= contactAbove,
    etaDaysMin,
    etaDaysMax,
  };
}

export async function generateOrderNumber(): Promise<string> {
  const now = new Date();
  const stamp = `${String(now.getFullYear()).slice(2)}${String(now.getMonth() + 1).padStart(2, "0")}`;
  for (let i = 0; i < 5; i++) {
    const rand = randomBytes(3).toString("hex").toUpperCase().slice(0, 5);
    const candidate = `SLPL-${stamp}-${rand}`;
    const clash = await db.order.findUnique({ where: { orderNumber: candidate } });
    if (!clash) return candidate;
  }
  throw new OrderError("Could not allocate an order number - please retry.");
}

type AddressSnapshot = {
  label: string;
  fullName: string;
  phone: string;
  line1: string;
  line2: string | null;
  landmark: string | null;
  city: string;
  state: string;
  pincode: string;
  lat: number | null;
  lng: number | null;
};

/**
 * Create the order + items and reserve stock atomically. Stock is decremented
 * up-front; EXPIRED/FAILED/CANCELLED restock via releaseOrderStock.
 */
export async function createOrderRecord(params: {
  userId: string;
  quote: Quote;
  address: AddressSnapshot;
  customer: { name: string; email: string; phone: string };
  method: "RAZORPAY" | "COD";
  notes?: string;
  /** Handed over at a school instead of couriered. */
  fulfilment?: "SHIP" | "COLLECT_AT_SCHOOL";
  /**
   * Written in the same transaction as the order, so a kit order can never
   * exist without the receipt row that the school will scan.
   */
  kitPurchase?: Prisma.KitPurchaseCreateWithoutOrderInput;
}): Promise<{ orderId: string; orderNumber: string }> {
  const { quote, method } = params;
  const orderNumber = await generateOrderNumber();

  const order = await db.$transaction(async (tx) => {
    try {
      await reserveStock(tx, quote.items);
    } catch (err) {
      if (err instanceof StockError) throw new OrderError(err.message);
      throw err;
    }

    const created = await tx.order.create({
      data: {
        orderNumber,
        userId: params.userId,
        status: method === "COD" ? "COD_PENDING_OTP" : "AWAITING_PAYMENT",
        paymentMethod: method,
        subtotal: quote.subtotal,
        discount: quote.discount,
        couponCode: quote.couponCode,
        shippingFee: quote.shippingFee,
        total: quote.total,
        shippingAddress: params.address,
        customerName: params.customer.name,
        customerEmail: params.customer.email,
        customerPhone: params.customer.phone,
        notes: params.notes,
        fulfilment: params.fulfilment ?? "SHIP",
        reservedUntil: new Date(Date.now() + RESERVATION_MINUTES * 60 * 1000),
        items: {
          create: quote.items.map((i) => ({
            productId: i.productId,
            title: i.title,
            unitPrice: i.unitPrice,
            quantity: i.quantity,
            image: i.image,
          })),
        },
        payment: {
          create: {
            provider: method === "COD" ? "cod" : "razorpay",
            status: "CREATED",
            amount: quote.total,
          },
        },
        events: {
          create: {
            status: method === "COD" ? "COD_PENDING_OTP" : "AWAITING_PAYMENT",
            note: "Order placed",
          },
        },
        ...(params.kitPurchase ? { kitPurchases: { create: params.kitPurchase } } : {}),
      },
    });
    return created;
  });

  return { orderId: order.id, orderNumber: order.orderNumber };
}

export async function restockOrder(orderId: string): Promise<void> {
  await db.$transaction(async (tx) => {
    const items = await tx.orderItem.findMany({ where: { orderId } });
    await releaseStock(
      tx,
      items
        .filter((i) => i.productId)
        .map((i) => ({ productId: i.productId!, quantity: i.quantity })),
    );
  });

  // Every cancellation path sets CANCELLED and then restocks, so this is the
  // one place that catches all of them. EXPIRED and PAYMENT_FAILED restock too
  // but stay revivable, so their receipts are left alone.
  const order = await db.order.findUnique({ where: { id: orderId }, select: { status: true } });
  if (order?.status !== "CANCELLED" && order?.status !== "REFUNDED") return;
  const purchases = await db.kitPurchase.findMany({
    where: { orderId, status: { in: ["PENDING", "PAID", "READY"] } },
    select: { id: true },
  });
  for (const purchase of purchases) {
    await db.$transaction([
      db.kitPurchase.update({ where: { id: purchase.id }, data: { status: "CANCELLED" } }),
      db.kitCollectionEvent.create({
        data: { purchaseId: purchase.id, status: "CANCELLED", note: "Order cancelled" },
      }),
    ]);
  }
}

/**
 * A collected kit cannot be unwound: the books are already with the family.
 * Both cancel paths check this before refunding anything.
 */
export async function hasCollectedKit(orderId: string): Promise<boolean> {
  const collected = await db.kitPurchase.count({ where: { orderId, status: "COLLECTED" } });
  return collected > 0;
}

function orderEmailBody(order: {
  orderNumber: string;
  total: number;
  shippingFee: number;
  discount: number;
  subtotal: number;
  customerName: string;
  shippingAddress: unknown;
  items: { title: string; quantity: number; unitPrice: number }[];
}): string {
  const addr = order.shippingAddress as AddressSnapshot;
  const rows = order.items
    .map(
      (i) =>
        `<tr><td style="padding:6px 0">${i.title} × ${i.quantity}</td><td align="right" style="padding:6px 0">${formatINR(i.unitPrice * i.quantity)}</td></tr>`,
    )
    .join("");
  return `
    <p style="margin:0 0 14px">Hi ${order.customerName}, thank you for shopping with SLPL Store.</p>
    <table role="presentation" width="100%" style="font-size:14px;border-collapse:collapse">
      ${rows}
      <tr><td style="padding:6px 0;border-top:1px solid #e3e8f2">Subtotal</td><td align="right" style="padding:6px 0;border-top:1px solid #e3e8f2">${formatINR(order.subtotal)}</td></tr>
      ${order.discount > 0 ? `<tr><td style="padding:2px 0;color:#15803d">Discount</td><td align="right" style="padding:2px 0;color:#15803d">−${formatINR(order.discount)}</td></tr>` : ""}
      <tr><td style="padding:2px 0">Shipping</td><td align="right" style="padding:2px 0">${order.shippingFee === 0 ? "Free" : formatINR(order.shippingFee)}</td></tr>
      <tr><td style="padding:8px 0;font-weight:bold;font-size:16px">Total</td><td align="right" style="padding:8px 0;font-weight:bold;font-size:16px">${formatINR(order.total)}</td></tr>
    </table>
    <p style="margin:14px 0 0;font-size:13px;color:#5a6478">Delivering to: ${addr.fullName}, ${addr.line1}${addr.line2 ? ", " + addr.line2 : ""}, ${addr.city}, ${addr.state} - ${addr.pincode}</p>`;
}

/** Idempotent: flips an order to PAID once, restores nothing, emails both sides. */
export async function markOrderPaid(
  orderId: string,
  info: { razorpayPaymentId?: string; method?: string; via: string },
): Promise<void> {
  const order = await db.order.findUnique({
    where: { id: orderId },
    include: { items: true, payment: true },
  });
  if (!order || order.status === "PAID") return;
  if (!["AWAITING_PAYMENT", "PAYMENT_FAILED", "EXPIRED"].includes(order.status)) return;

  // EXPIRED and PAYMENT_FAILED already restocked the items - re-reserve before paying
  if (order.status === "EXPIRED" || order.status === "PAYMENT_FAILED") {
    await db.$transaction(async (tx) => {
      await reserveStock(
        tx,
        order.items
          .filter((i) => i.productId)
          .map((i) => ({ productId: i.productId!, quantity: i.quantity })),
        { force: true }, // payment already succeeded, never refuse it here
      );
    });
  }

  await db.$transaction([
    db.order.update({
      where: { id: orderId },
      data: { status: "PAID", reservedUntil: null },
    }),
    db.payment.update({
      where: { orderId },
      data: {
        status: "CAPTURED",
        razorpayPaymentId: info.razorpayPaymentId,
        method: info.method,
      },
    }),
    db.orderEvent.create({
      data: { orderId, status: "PAID", note: `Payment confirmed (${info.via})` },
    }),
    ...(order.couponCode
      ? [db.coupon.updateMany({ where: { code: order.couponCode }, data: { usedCount: { increment: 1 } } })]
      : []),
  ]);

  // A subscription has no parcel to pack: activate the term and welcome them
  // rather than sending the packing mail.
  const subs = await db.subscription.count({ where: { orderId } });
  if (subs > 0) {
    await db.cart.deleteMany({ where: { userId: order.userId } });
    await activateSubscriptions(orderId);
    await notifyUser(
      order.userId,
      "Subscription active",
      "Your GenZ Times subscription is confirmed. The first issue is posted as it prints.",
      "/account/subscriptions",
    );
    return;
  }

  // A kit is collected at the school, never couriered, so it gets the receipt
  // rather than the packing-and-shipping mail.
  if (order.fulfilment === "COLLECT_AT_SCHOOL") {
    const purchases = await db.kitPurchase.findMany({
      where: { orderId, status: "PENDING" },
      select: { id: true, studentName: true, accessToken: true },
    });
    for (const purchase of purchases) {
      await db.$transaction([
        db.kitPurchase.update({ where: { id: purchase.id }, data: { status: "PAID" } }),
        db.kitCollectionEvent.create({
          data: { purchaseId: purchase.id, status: "PAID", note: `Payment confirmed (${info.via})` },
        }),
      ]);
      await emailKitReceipt(purchase.id);
      await notifyUser(
        order.userId,
        "Kit receipt ready",
        `The kit for ${purchase.studentName} is paid for. Show the receipt at the school to collect it.`,
        `/kits/receipt/${purchase.accessToken}`,
      );
    }
    return;
  }

  await db.cart.deleteMany({ where: { userId: order.userId } });
  await notifyUser(
    order.userId,
    "Order confirmed",
    `Payment received for order ${order.orderNumber}. We are packing your books.`,
    `/account/orders/${order.orderNumber}`,
  );
  if ((await getPrefs(order.userId)).orderSms) {
    await sendSms(
      order.customerPhone,
      // "Rs." keeps the SMS in plain GSM text; the rupee sign would force short UCS-2 segments
      `SLPL Store: payment received for order ${order.orderNumber} (Rs. ${Math.round(order.total / 100)}). We are packing your books.`,
    );
  }

  await sendEmail({
    to: order.customerEmail,
    subject: `Order ${order.orderNumber} confirmed - SLPL Store`,
    template: "order-paid",
    html: renderEmail("Your order is confirmed 🎉", orderEmailBody(order)),
  });
  await notifyOwner(
    `New paid order ${order.orderNumber} - ${formatINR(order.total)}`,
    renderEmail(
      "New order received",
      orderEmailBody(order) +
        `<p style="margin:14px 0 0"><b>Action:</b> open the admin panel → Orders → ${order.orderNumber} to pack & ship.</p>`,
    ),
    "owner-new-order",
  );
}

export async function confirmCodOrder(orderId: string): Promise<void> {
  const order = await db.order.findUnique({
    where: { id: orderId },
    include: { items: true },
  });
  if (!order || order.status !== "COD_PENDING_OTP") return;

  await db.$transaction([
    db.order.update({ where: { id: orderId }, data: { status: "CONFIRMED", reservedUntil: null } }),
    db.orderEvent.create({
      data: { orderId, status: "CONFIRMED", note: "COD confirmed via email OTP" },
    }),
    ...(order.couponCode
      ? [db.coupon.updateMany({ where: { code: order.couponCode }, data: { usedCount: { increment: 1 } } })]
      : []),
  ]);
  await db.cart.deleteMany({ where: { userId: order.userId } });
  await notifyUser(
    order.userId,
    "COD order confirmed",
    `Order ${order.orderNumber} is confirmed. Keep the amount ready at delivery.`,
    `/account/orders/${order.orderNumber}`,
  );
  if ((await getPrefs(order.userId)).orderSms) {
    await sendSms(
      order.customerPhone,
      `SLPL Store: COD order ${order.orderNumber} confirmed. Please keep Rs. ${Math.round(order.total / 100)} ready at delivery.`,
    );
  }

  await sendEmail({
    to: order.customerEmail,
    subject: `Order ${order.orderNumber} confirmed (Cash on Delivery) - SLPL Store`,
    template: "order-cod-confirmed",
    html: renderEmail(
      "Your COD order is confirmed",
      orderEmailBody(order) +
        `<p style="margin:14px 0 0">Please keep <b>${formatINR(order.total)}</b> ready at delivery.</p>`,
    ),
  });
  await notifyOwner(
    `New COD order ${order.orderNumber} - ${formatINR(order.total)}`,
    renderEmail("New COD order", orderEmailBody(order)),
    "owner-new-order",
  );
}

export async function markPaymentFailed(orderId: string, reason: string): Promise<void> {
  const order = await db.order.findUnique({ where: { id: orderId } });
  if (!order || order.status !== "AWAITING_PAYMENT") return;
  await db.$transaction([
    db.order.update({ where: { id: orderId }, data: { status: "PAYMENT_FAILED" } }),
    db.payment.update({ where: { orderId }, data: { status: "FAILED" } }),
    db.orderEvent.create({ data: { orderId, status: "PAYMENT_FAILED", note: reason } }),
  ]);
  await restockOrder(orderId);
}

/** Worker job: expire unpaid reservations and restock. */
export async function releaseExpiredOrders(): Promise<number> {
  const stale = await db.order.findMany({
    where: { status: "AWAITING_PAYMENT", reservedUntil: { lt: new Date() } },
    select: { id: true },
  });
  for (const { id } of stale) {
    await db.$transaction([
      db.order.update({ where: { id }, data: { status: "EXPIRED" } }),
      db.orderEvent.create({
        data: { orderId: id, status: "EXPIRED", note: "Payment window elapsed - stock released" },
      }),
    ]);
    await restockOrder(id);
  }
  return stale.length;
}

/**
 * Worker job: ask Razorpay about pending orders (handles the browser dying
 * mid-payment and missed webhooks). Requires configured keys.
 */
export async function reconcilePendingPayments(): Promise<void> {
  if (!isRazorpayConfigured()) return;
  const cutoff = new Date(Date.now() - 10 * 60 * 1000);
  const pending = await db.order.findMany({
    where: {
      status: { in: ["AWAITING_PAYMENT", "EXPIRED"] },
      createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000), lte: cutoff },
    },
    include: { payment: true },
  });
  for (const order of pending) {
    const rzpOrderId = order.payment?.razorpayOrderId;
    if (!rzpOrderId) continue;
    try {
      const payments = await fetchPaymentsForOrder(rzpOrderId);
      const captured = payments.find((p) => p.status === "captured");
      if (captured) {
        if (order.status === "EXPIRED") {
          // Late capture on an expired order → refund and apologise
          await refundPayment(captured.id);
          await db.orderEvent.create({
            data: {
              orderId: order.id,
              status: "REFUNDED",
              note: "Late payment auto-refunded (reservation had expired)",
            },
          });
          await db.payment.update({
            where: { orderId: order.id },
            data: { status: "REFUNDED", refundedAmount: captured.amount },
          });
          await db.order.update({ where: { id: order.id }, data: { status: "REFUNDED" } });
          await sendEmail({
            to: order.customerEmail,
            subject: `Order ${order.orderNumber} - payment refunded`,
            template: "late-payment-refund",
            html: renderEmail(
              "Your payment was refunded",
              `<p>Your payment for order ${order.orderNumber} arrived after the reservation window closed, so it has been auto-refunded in full. The amount returns to your account within 5-7 working days. Please place the order again.</p>`,
            ),
          });
        } else {
          await markOrderPaid(order.id, {
            razorpayPaymentId: captured.id,
            method: captured.method,
            via: "reconciliation",
          });
        }
      } else if (
        payments.length > 0 &&
        payments.every((p) => p.status === "failed") &&
        order.status === "AWAITING_PAYMENT"
      ) {
        await markPaymentFailed(order.id, "All payment attempts failed (reconciliation)");
      }
    } catch (err) {
      console.error("[reconcile] order", order.orderNumber, err);
    }
  }
}
