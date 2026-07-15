"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import {
  checkAdminPassword,
  clientIp,
  createAdminSession,
  destroyAdminSession,
  isAdmin,
  isLockedOut,
  recordLoginResult,
} from "@/lib/admin-auth";
import { db } from "@/lib/db";
import { markOrderPaid, restockOrder } from "@/lib/orders";
import { emailDelivered, emailOutForDelivery, emailShipped } from "@/lib/shipment-notify";
import { createShipmentForOrder, isShiprocketConfigured } from "@/lib/shipping/shiprocket";
import { isRazorpayConfigured, refundPayment } from "@/lib/razorpay";
import { renderEmail, sendEmail } from "@/lib/email";
import { formatINR } from "@/lib/money";

// ── Login / logout ───────────────────────────────────────────────────────────

export type AdminLoginState = { error?: string };

export async function adminLogin(
  _prev: AdminLoginState,
  formData: FormData,
): Promise<AdminLoginState> {
  const ip = await clientIp();
  if (isLockedOut(ip)) {
    return { error: "Too many wrong attempts - locked for 15 minutes." };
  }
  const password = String(formData.get("password") ?? "");
  const ok = await checkAdminPassword(password);
  recordLoginResult(ip, ok);
  if (!ok) return { error: "Wrong password." };
  await createAdminSession();
  redirect("/admin");
}

export async function adminLogout(): Promise<void> {
  await destroyAdminSession();
  redirect("/admin/login");
}

async function ensureAdmin(): Promise<string | null> {
  return (await isAdmin()) ? null : "UNAUTHORIZED";
}

type Result = { ok?: boolean; error?: string; id?: string };

// ── Products ─────────────────────────────────────────────────────────────────

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

const productSchema = z.object({
  id: z.string().optional(),
  title: z.string().trim().min(2).max(160),
  slug: z.string().trim().max(90).optional().or(z.literal("")),
  kind: z.enum(["BOOK", "NOVEL", "POEMS", "BUNDLE"]),
  categoryId: z.string().min(1),
  series: z.string().trim().max(80).optional().or(z.literal("")),
  gradeLabel: z.string().trim().max(40).optional().or(z.literal("")),
  description: z.string().trim().min(10).max(3000),
  mrp: z.number().int().min(100).max(100_000_00),
  price: z.number().int().min(100).max(100_000_00),
  salePrice: z.number().int().min(100).max(100_000_00).nullable().optional(),
  saleStart: z.string().nullable().optional(),
  saleEnd: z.string().nullable().optional(),
  stock: z.number().int().min(0).max(100_000),
  weightGrams: z.number().int().min(50).max(50_000),
  coverImage: z.string().max(300).nullable().optional(),
  gallery: z.array(z.string().max(300)).max(8).optional(),
  samplePdf: z.string().max(300).nullable().optional(),
  isNewRelease: z.boolean(),
  isFeatured: z.boolean(),
  isVisible: z.boolean(),
});

export type ProductInput = z.infer<typeof productSchema>;

export async function saveProduct(input: ProductInput): Promise<Result> {
  const denied = await ensureAdmin();
  if (denied) return { error: denied };
  const parsed = productSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const d = parsed.data;
  if (d.price > d.mrp) return { error: "Selling price cannot exceed MRP." };
  if (d.salePrice != null && d.salePrice >= d.price) {
    return { error: "Sale price must be below the regular price." };
  }

  const slug = d.slug?.trim() ? slugify(d.slug) : slugify(d.title);
  const clash = await db.product.findFirst({
    where: { slug, ...(d.id ? { NOT: { id: d.id } } : {}) },
  });
  if (clash) return { error: `Slug “${slug}” is already used by “${clash.title}”.` };

  const data = {
    title: d.title,
    slug,
    kind: d.kind,
    categoryId: d.categoryId,
    series: d.series || null,
    gradeLabel: d.gradeLabel || null,
    description: d.description,
    mrp: d.mrp,
    price: d.price,
    salePrice: d.salePrice ?? null,
    saleStart: d.saleStart ? new Date(d.saleStart) : null,
    saleEnd: d.saleEnd ? new Date(d.saleEnd) : null,
    stock: d.stock,
    weightGrams: d.weightGrams,
    coverImage: d.coverImage || null,
    gallery: d.gallery ?? [],
    samplePdf: d.samplePdf || null,
    isNewRelease: d.isNewRelease,
    isFeatured: d.isFeatured,
    isVisible: d.isVisible,
  };

  const row = d.id
    ? await db.product.update({ where: { id: d.id }, data })
    : await db.product.create({ data });
  return { ok: true, id: row.id };
}

export async function toggleProductVisible(id: string, visible: boolean): Promise<Result> {
  const denied = await ensureAdmin();
  if (denied) return { error: denied };
  await db.product.update({ where: { id }, data: { isVisible: visible } });
  return { ok: true };
}

export async function deleteProduct(id: string): Promise<Result> {
  const denied = await ensureAdmin();
  if (denied) return { error: denied };
  const inBundles = await db.bundleItem.count({ where: { productId: id } });
  if (inBundles > 0) {
    return { error: "This book is inside a bundle - remove it from the bundle first." };
  }
  await db.product.delete({ where: { id } }); // order items keep their snapshot (SetNull)
  return { ok: true };
}

export async function setBundleItems(
  bundleId: string,
  items: { productId: string; quantity: number }[],
): Promise<Result> {
  const denied = await ensureAdmin();
  if (denied) return { error: denied };
  const bundle = await db.product.findUnique({ where: { id: bundleId } });
  if (!bundle || bundle.kind !== "BUNDLE") return { error: "Not a bundle." };
  if (items.some((i) => i.productId === bundleId)) return { error: "A bundle cannot contain itself." };

  await db.$transaction(async (tx) => {
    await tx.bundleItem.deleteMany({ where: { bundleId } });
    for (const item of items) {
      await tx.bundleItem.create({
        data: {
          bundleId,
          productId: item.productId,
          quantity: Math.min(Math.max(1, item.quantity), 20),
        },
      });
    }
  });
  return { ok: true };
}

// ── Coupons ──────────────────────────────────────────────────────────────────

const couponSchema = z.object({
  id: z.string().optional(),
  code: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9]{3,20}$/, "Code: 3-20 letters/numbers"),
  type: z.enum(["PERCENT", "FLAT"]),
  value: z.number().int().min(1),
  minOrder: z.number().int().min(0),
  maxDiscount: z.number().int().min(100).nullable().optional(),
  startsAt: z.string().nullable().optional(),
  endsAt: z.string().nullable().optional(),
  usageLimit: z.number().int().min(1).nullable().optional(),
  isActive: z.boolean(),
});

export type CouponInput = z.infer<typeof couponSchema>;

export async function saveCoupon(input: CouponInput): Promise<Result> {
  const denied = await ensureAdmin();
  if (denied) return { error: denied };
  const parsed = couponSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const d = parsed.data;
  if (d.type === "PERCENT" && d.value > 90) return { error: "Percent discount capped at 90%." };

  const data = {
    code: d.code,
    type: d.type,
    value: d.value,
    minOrder: d.minOrder,
    maxDiscount: d.maxDiscount ?? null,
    startsAt: d.startsAt ? new Date(d.startsAt) : null,
    endsAt: d.endsAt ? new Date(d.endsAt) : null,
    usageLimit: d.usageLimit ?? null,
    isActive: d.isActive,
  };
  if (d.id) await db.coupon.update({ where: { id: d.id }, data });
  else {
    const clash = await db.coupon.findUnique({ where: { code: d.code } });
    if (clash) return { error: "This code already exists." };
    await db.coupon.create({ data });
  }
  return { ok: true };
}

export async function deleteCoupon(id: string): Promise<Result> {
  const denied = await ensureAdmin();
  if (denied) return { error: denied };
  await db.coupon.delete({ where: { id } });
  return { ok: true };
}

// ── Festival sales ───────────────────────────────────────────────────────────

const saleSchema = z.object({
  id: z.string().optional(),
  name: z.string().trim().min(2).max(80),
  bannerText: z.string().trim().min(4).max(200),
  discountType: z.enum(["PERCENT", "FLAT"]),
  value: z.number().int().min(1),
  categoryIds: z.array(z.string()).max(10),
  startsAt: z.string().min(4),
  endsAt: z.string().min(4),
  isActive: z.boolean(),
});

export type SaleInput = z.infer<typeof saleSchema>;

export async function saveSaleEvent(input: SaleInput): Promise<Result> {
  const denied = await ensureAdmin();
  if (denied) return { error: denied };
  const parsed = saleSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const d = parsed.data;
  if (d.discountType === "PERCENT" && d.value > 90) return { error: "Percent discount capped at 90%." };
  const data = {
    name: d.name,
    bannerText: d.bannerText,
    discountType: d.discountType,
    value: d.value,
    categoryIds: d.categoryIds,
    startsAt: new Date(d.startsAt),
    endsAt: new Date(d.endsAt),
    isActive: d.isActive,
  };
  if (data.endsAt <= data.startsAt) return { error: "Sale must end after it starts." };
  if (d.id) await db.saleEvent.update({ where: { id: d.id }, data });
  else await db.saleEvent.create({ data });
  return { ok: true };
}

export async function deleteSaleEvent(id: string): Promise<Result> {
  const denied = await ensureAdmin();
  if (denied) return { error: denied };
  await db.saleEvent.delete({ where: { id } });
  return { ok: true };
}

// ── Settings & services ──────────────────────────────────────────────────────

const NUMERIC_SETTINGS = new Set([
  "cod_max_order_value",
  "bulk_otp_threshold",
  "contact_us_threshold",
  "free_shipping_threshold",
  "shipping_flat_fee",
]);
const TEXT_SETTINGS = new Set(["origin_pincode", "store_notice", "contact_phone", "contact_email"]);

export async function saveSettings(values: Record<string, string>): Promise<Result> {
  const denied = await ensureAdmin();
  if (denied) return { error: denied };
  for (const [key, raw] of Object.entries(values)) {
    let value: unknown;
    if (NUMERIC_SETTINGS.has(key)) {
      const n = Number(raw);
      if (!Number.isFinite(n) || n < 0) return { error: `“${key}” must be a positive number.` };
      value = Math.round(n);
    } else if (TEXT_SETTINGS.has(key)) {
      value = raw.slice(0, 500);
    } else {
      continue; // unknown keys are ignored
    }
    await db.setting.upsert({ where: { key }, update: { value: value as object }, create: { key, value: value as object } });
  }
  return { ok: true };
}

const serviceSchema = z.object({
  id: z.string().min(1),
  title: z.string().trim().min(2).max(120),
  tagline: z.string().trim().max(160).optional().or(z.literal("")),
  description: z.string().trim().min(10).max(2000),
  bannerImage: z.string().max(300).nullable().optional(),
  externalUrl: z.string().url().max(300).nullable().optional(),
  sortOrder: z.number().int().min(0).max(99),
  isVisible: z.boolean(),
});

export type ServiceInput = z.infer<typeof serviceSchema>;

export async function saveService(input: ServiceInput): Promise<Result> {
  const denied = await ensureAdmin();
  if (denied) return { error: denied };
  const parsed = serviceSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const d = parsed.data;
  await db.servicePage.update({
    where: { id: d.id },
    data: {
      title: d.title,
      tagline: d.tagline || null,
      description: d.description,
      bannerImage: d.bannerImage || null,
      externalUrl: d.externalUrl || null,
      sortOrder: d.sortOrder,
      isVisible: d.isVisible,
    },
  });
  return { ok: true };
}

// ── Order operations ─────────────────────────────────────────────────────────

function findOrder(orderNumber: string) {
  return db.order.findUnique({
    where: { orderNumber },
    include: { payment: true, shipment: true, items: true },
  });
}

export async function orderMarkProcessing(orderNumber: string): Promise<Result> {
  const denied = await ensureAdmin();
  if (denied) return { error: denied };
  const order = await findOrder(orderNumber);
  if (!order) return { error: "Order not found." };
  if (!["PAID", "CONFIRMED"].includes(order.status)) {
    return { error: "Only paid/confirmed orders can move to packing." };
  }
  await db.$transaction([
    db.order.update({ where: { id: order.id }, data: { status: "PROCESSING" } }),
    db.orderEvent.create({ data: { orderId: order.id, status: "PROCESSING", note: "Packing started" } }),
  ]);
  return { ok: true };
}

const shipSchema = z.object({
  courierName: z.string().trim().min(2).max(60),
  awb: z.string().trim().min(4).max(40),
  trackingUrl: z.string().url().max(300).optional().or(z.literal("")),
  etaDays: z.number().int().min(1).max(30).nullable().optional(),
});

export async function orderShip(
  orderNumber: string,
  input: z.infer<typeof shipSchema>,
): Promise<Result> {
  const denied = await ensureAdmin();
  if (denied) return { error: denied };
  const parsed = shipSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const order = await findOrder(orderNumber);
  if (!order) return { error: "Order not found." };
  if (!["PAID", "CONFIRMED", "PROCESSING"].includes(order.status)) {
    return { error: "This order is not ready to ship." };
  }

  const d = parsed.data;
  const trackingUrl = d.trackingUrl || null;
  const shipment = await db.shipment.upsert({
    where: { orderId: order.id },
    update: {
      provider: order.shipment?.provider ?? "manual",
      status: "IN_TRANSIT",
      courierName: d.courierName,
      awb: d.awb,
      trackingUrl,
      etaDays: d.etaDays ?? null,
    },
    create: {
      orderId: order.id,
      provider: "manual",
      status: "IN_TRANSIT",
      courierName: d.courierName,
      awb: d.awb,
      trackingUrl,
      etaDays: d.etaDays ?? null,
    },
  });
  await db.$transaction([
    db.order.update({ where: { id: order.id }, data: { status: "SHIPPED" } }),
    db.orderEvent.create({
      data: {
        orderId: order.id,
        status: "SHIPPED",
        note: `Via ${d.courierName} · AWB ${d.awb}`,
      },
    }),
    db.shipmentEvent.create({
      data: { shipmentId: shipment.id, status: "IN_TRANSIT", description: "Handed to courier" },
    }),
  ]);
  await emailShipped(order, { courierName: d.courierName, awb: d.awb, trackingUrl, etaDays: d.etaDays ?? null });
  return { ok: true };
}

/** One click: create the Shiprocket order, get an AWB, schedule pickup, email the customer. */
export async function orderShipViaShiprocket(orderNumber: string): Promise<Result> {
  const denied = await ensureAdmin();
  if (denied) return { error: denied };
  if (!isShiprocketConfigured()) {
    return { error: "Shiprocket is not configured yet - add the API credentials in .env (see docs/INTEGRATIONS.md)." };
  }
  const order = await db.order.findUnique({
    where: { orderNumber },
    include: { items: { include: { product: { select: { weightGrams: true } } } }, shipment: true },
  });
  if (!order) return { error: "Order not found." };
  if (!["PAID", "CONFIRMED", "PROCESSING"].includes(order.status)) {
    return { error: "This order is not ready to ship." };
  }
  if (order.shipment?.awb) return { error: "This order already has an AWB." };

  const weightGrams = order.items.reduce(
    (sum, i) => sum + (i.product?.weightGrams ?? 350) * i.quantity,
    0,
  );

  try {
    const sr = await createShipmentForOrder({
      orderNumber: order.orderNumber,
      createdAt: order.createdAt,
      paymentMethod: order.paymentMethod,
      subtotal: order.subtotal,
      total: order.total,
      customerEmail: order.customerEmail,
      shippingAddress: order.shippingAddress as Parameters<typeof createShipmentForOrder>[0]["shippingAddress"],
      items: order.items.map((i) => ({
        title: i.title,
        unitPrice: i.unitPrice,
        quantity: i.quantity,
        productId: i.productId,
      })),
      weightGrams,
    });

    const shipment = await db.shipment.upsert({
      where: { orderId: order.id },
      update: {
        provider: "shiprocket",
        status: "PICKUP_SCHEDULED",
        courierName: sr.courierName,
        awb: sr.awb,
        trackingUrl: sr.trackingUrl,
        shiprocketOrderId: sr.shiprocketOrderId,
        shiprocketShipmentId: sr.shiprocketShipmentId,
      },
      create: {
        orderId: order.id,
        provider: "shiprocket",
        status: "PICKUP_SCHEDULED",
        courierName: sr.courierName,
        awb: sr.awb,
        trackingUrl: sr.trackingUrl,
        shiprocketOrderId: sr.shiprocketOrderId,
        shiprocketShipmentId: sr.shiprocketShipmentId,
      },
    });
    await db.$transaction([
      db.order.update({ where: { id: order.id }, data: { status: "SHIPPED" } }),
      db.orderEvent.create({
        data: { orderId: order.id, status: "SHIPPED", note: `Shiprocket · ${sr.courierName} · AWB ${sr.awb}` },
      }),
      db.shipmentEvent.create({
        data: { shipmentId: shipment.id, status: "PICKUP_SCHEDULED", description: "Shipment created, pickup requested" },
      }),
    ]);
    await emailShipped(order, { courierName: sr.courierName, awb: sr.awb, trackingUrl: sr.trackingUrl, etaDays: null });
    return { ok: true };
  } catch (err) {
    return { error: `Shiprocket error: ${err instanceof Error ? err.message : String(err)}` };
  }
}

export async function orderOutForDelivery(orderNumber: string): Promise<Result> {
  const denied = await ensureAdmin();
  if (denied) return { error: denied };
  const order = await findOrder(orderNumber);
  if (!order) return { error: "Order not found." };
  if (order.status !== "SHIPPED") return { error: "Order must be shipped first." };
  await db.$transaction([
    db.order.update({ where: { id: order.id }, data: { status: "OUT_FOR_DELIVERY" } }),
    db.orderEvent.create({ data: { orderId: order.id, status: "OUT_FOR_DELIVERY" } }),
    ...(order.shipment
      ? [
          db.shipment.update({ where: { id: order.shipment.id }, data: { status: "OUT_FOR_DELIVERY" } }),
          db.shipmentEvent.create({
            data: { shipmentId: order.shipment.id, status: "OUT_FOR_DELIVERY", description: "Out for delivery" },
          }),
        ]
      : []),
  ]);
  if (order.shipment) {
    await emailOutForDelivery(order, order.shipment);
  }
  return { ok: true };
}

export async function orderDelivered(orderNumber: string): Promise<Result> {
  const denied = await ensureAdmin();
  if (denied) return { error: denied };
  const order = await findOrder(orderNumber);
  if (!order) return { error: "Order not found." };
  if (!["SHIPPED", "OUT_FOR_DELIVERY"].includes(order.status)) {
    return { error: "Order is not in transit." };
  }
  await db.$transaction([
    db.order.update({ where: { id: order.id }, data: { status: "DELIVERED" } }),
    db.orderEvent.create({ data: { orderId: order.id, status: "DELIVERED" } }),
    ...(order.shipment
      ? [
          db.shipment.update({ where: { id: order.shipment.id }, data: { status: "DELIVERED" } }),
          db.shipmentEvent.create({
            data: { shipmentId: order.shipment.id, status: "DELIVERED", description: "Delivered" },
          }),
        ]
      : []),
  ]);
  await emailDelivered(order);
  return { ok: true };
}

export async function orderCancel(orderNumber: string): Promise<Result> {
  const denied = await ensureAdmin();
  if (denied) return { error: denied };
  const order = await findOrder(orderNumber);
  if (!order) return { error: "Order not found." };
  if (!["AWAITING_PAYMENT", "COD_PENDING_OTP", "PAID", "CONFIRMED", "PROCESSING"].includes(order.status)) {
    return { error: "Shipped orders cannot be cancelled from here." };
  }

  const wasCaptured = order.payment?.status === "CAPTURED";
  await db.$transaction([
    db.order.update({ where: { id: order.id }, data: { status: "CANCELLED" } }),
    db.orderEvent.create({ data: { orderId: order.id, status: "CANCELLED", note: "Cancelled by store" } }),
  ]);
  await restockOrder(order.id);

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
    } catch (err) {
      return { error: `Cancelled, but refund failed - do it from the Razorpay dashboard. (${String(err)})` };
    }
  }

  await sendEmail({
    to: order.customerEmail,
    subject: `Order ${order.orderNumber} cancelled`,
    template: "order-cancelled",
    html: renderEmail(
      "Your order was cancelled",
      `<p>Order <b>${order.orderNumber}</b> (${formatINR(order.total)}) has been cancelled.${wasCaptured ? " Your payment is being refunded and should reach your account in 5-7 working days." : ""}</p>`,
    ),
  });
  return { ok: true };
}

export async function orderMarkPaidManually(orderNumber: string): Promise<Result> {
  const denied = await ensureAdmin();
  if (denied) return { error: denied };
  const order = await findOrder(orderNumber);
  if (!order) return { error: "Order not found." };
  if (order.status !== "AWAITING_PAYMENT") return { error: "Order is not awaiting payment." };
  await markOrderPaid(order.id, { via: "admin-manual" });
  return { ok: true };
}
