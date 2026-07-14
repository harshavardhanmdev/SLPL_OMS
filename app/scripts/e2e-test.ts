/**
 * End-to-end exercise of the order engine against the dev DB + Mailpit.
 * Run: NODE_OPTIONS=--conditions=react-server npx tsx scripts/e2e-test.ts
 */
import "dotenv/config";
import bcrypt from "bcryptjs";

import { db } from "../src/lib/db";
import {
  confirmCodOrder,
  createOrderRecord,
  markOrderPaid,
  quoteCart,
  releaseExpiredOrders,
} from "../src/lib/orders";
import { issueOtp, verifyOtp } from "../src/lib/otp";

const assert = (cond: unknown, msg: string) => {
  if (!cond) throw new Error(`ASSERT FAILED: ${msg}`);
  console.log(`  ✓ ${msg}`);
};

async function main() {
  console.log("1) test user + address");
  const email = "e2e-buyer@test.local";
  const user = await db.user.upsert({
    where: { email },
    update: {},
    create: { email, name: "E2E Buyer", passwordHash: await bcrypt.hash("test-password-1", 11) },
  });

  console.log("2) quote");
  const p1 = await db.product.findUniqueOrThrow({ where: { slug: "skill-builders-grade-6" } });
  const p2 = await db.product.findUniqueOrThrow({ where: { slug: "life-of-student" } });
  const lines = [
    { productId: p1.id, quantity: 1 },
    { productId: p2.id, quantity: 2 },
  ];
  const quote = await quoteCart(lines, null, "110001");
  assert(quote.items.length === 2, "quote has 2 items");
  const expectedSubtotal = p1.price + p2.price * 2;
  assert(quote.subtotal === expectedSubtotal, `subtotal = ${expectedSubtotal}`);
  assert(quote.shippingFee > 0, "shipping fee applied");
  assert(quote.total === quote.subtotal + quote.shippingFee, "total = subtotal + shipping");
  assert(quote.codAllowed === quote.total <= 150000, "COD flag matches threshold");

  const address = {
    label: "HOME",
    fullName: "E2E Buyer",
    phone: "9876543210",
    line1: "12-3 Test Street",
    line2: null,
    landmark: null,
    city: "New Delhi",
    state: "Delhi",
    pincode: "110001",
    lat: null,
    lng: null,
  };
  const customer = { name: user.name, email: user.email, phone: "9876543210" };

  console.log("3) prepaid order — stock reservation");
  const stockBefore = p1.stock;
  const { orderId, orderNumber } = await createOrderRecord({
    userId: user.id,
    quote,
    address,
    customer,
    method: "RAZORPAY",
  });
  const p1After = await db.product.findUniqueOrThrow({ where: { id: p1.id } });
  assert(p1After.stock === stockBefore - 1, "stock decremented on order creation");
  console.log(`  order ${orderNumber}`);

  console.log("4) mark paid → emails");
  await markOrderPaid(orderId, { via: "e2e-test", method: "mock" });
  const paid = await db.order.findUniqueOrThrow({ where: { id: orderId } });
  assert(paid.status === "PAID", "order status PAID");
  await markOrderPaid(orderId, { via: "e2e-test-again" }); // idempotency
  const events = await db.orderEvent.count({ where: { orderId, status: "PAID" } });
  assert(events === 1, "markOrderPaid is idempotent (single PAID event)");
  const emails = await db.emailLog.findMany({
    where: { to: { in: [email, process.env.OWNER_NOTIFY_EMAIL ?? "saradapublications18@gmail.com"] } },
    orderBy: { createdAt: "desc" },
    take: 2,
  });
  assert(emails.length === 2 && emails.every((e) => e.status === "SENT"), "customer + owner emails SENT");

  console.log("5) expiry release restocks");
  const quote2 = await quoteCart([{ productId: p1.id, quantity: 2 }], null, "500001");
  const { orderId: expiringId } = await createOrderRecord({
    userId: user.id,
    quote: quote2,
    address,
    customer,
    method: "RAZORPAY",
  });
  await db.order.update({
    where: { id: expiringId },
    data: { reservedUntil: new Date(Date.now() - 60_000) },
  });
  const released = await releaseExpiredOrders();
  assert(released >= 1, "expired order released");
  const expired = await db.order.findUniqueOrThrow({ where: { id: expiringId } });
  assert(expired.status === "EXPIRED", "order marked EXPIRED");
  const p1Restocked = await db.product.findUniqueOrThrow({ where: { id: p1.id } });
  assert(p1Restocked.stock === stockBefore - 1, "stock restored after expiry (only paid order holds stock)");

  console.log("6) COD flow with email OTP");
  const quote3 = await quoteCart([{ productId: p2.id, quantity: 1 }], null, "500001");
  assert(quote3.codAllowed, "small order allows COD");
  const { orderId: codId, orderNumber: codNumber } = await createOrderRecord({
    userId: user.id,
    quote: quote3,
    address,
    customer,
    method: "COD",
  });
  const sent = await issueOtp(email, "COD_CONFIRM");
  assert(sent, "OTP issued");
  const token = await db.otpToken.findFirstOrThrow({
    where: { identifier: email, purpose: "COD_CONFIRM", consumedAt: null },
    orderBy: { createdAt: "desc" },
  });
  const bad = await verifyOtp(email, "COD_CONFIRM", "000000");
  assert(!bad.ok, "wrong OTP rejected");
  const good = await verifyOtp(email, "COD_CONFIRM", token.code);
  assert(good.ok, "correct OTP accepted");
  await confirmCodOrder(codId);
  const cod = await db.order.findUniqueOrThrow({ where: { id: codId } });
  assert(cod.status === "CONFIRMED", `COD order ${codNumber} CONFIRMED`);

  console.log("7) coupon");
  await db.coupon.upsert({
    where: { code: "E2ETEST" },
    update: { isActive: true, usedCount: 0 },
    create: { code: "E2ETEST", type: "PERCENT", value: 10, minOrder: 0, isActive: true },
  });
  const withCoupon = await quoteCart(lines, "E2ETEST", "110001");
  assert(withCoupon.discount === Math.round(withCoupon.subtotal * 0.1), "10% coupon applied");
  const badCoupon = await quoteCart(lines, "NOPE404", "110001");
  assert(badCoupon.discount === 0 && badCoupon.couponError != null, "invalid coupon rejected gracefully");

  console.log("\nALL E2E CHECKS PASSED ✅");
}

main()
  .catch((err) => {
    console.error("\nE2E FAILED ❌", err);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
