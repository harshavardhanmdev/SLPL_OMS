/**
 * Walks one subscription through the whole life it will really have: paid,
 * activated, welcomed by email, posted three issues, finished.
 *
 * Dev database only. It creates a throwaway reader, then deletes everything it
 * made, so it can be run as often as needed.
 *
 *   NODE_OPTIONS=--conditions=react-server npx tsx scripts/test-subscription-flow.ts
 */
import "dotenv/config";

import { db } from "../src/lib/db";
import { markOrderPaid } from "../src/lib/orders";
import { planById } from "../src/lib/subscription-plans";

const EMAIL = "subscription-test@theslpl.in";

function check(label: string, ok: boolean, detail = "") {
  console.log(`${ok ? "  ok  " : " FAIL "} ${label}${detail ? ` (${detail})` : ""}`);
  if (!ok) process.exitCode = 1;
}

async function cleanup() {
  const user = await db.user.findUnique({ where: { email: EMAIL } });
  if (!user) return;
  const orders = await db.order.findMany({ where: { userId: user.id }, select: { id: true } });
  const ids = orders.map((o) => o.id);
  await db.subscription.deleteMany({ where: { userId: user.id } });
  await db.orderEvent.deleteMany({ where: { orderId: { in: ids } } });
  await db.orderItem.deleteMany({ where: { orderId: { in: ids } } });
  await db.payment.deleteMany({ where: { orderId: { in: ids } } });
  await db.order.deleteMany({ where: { id: { in: ids } } });
  await db.emailLog.deleteMany({ where: { to: EMAIL } });
  await db.notification.deleteMany({ where: { userId: user.id } });
  await db.user.delete({ where: { id: user.id } });
}

async function main() {
  await cleanup();

  const plan = planById("annual")!;
  const user = await db.user.create({
    data: { email: EMAIL, name: "Test Reader", passwordHash: "x", emailVerified: new Date() },
  });

  // Mirrors exactly what subscribe() writes, including the absent reservation
  const order = await db.order.create({
    data: {
      orderNumber: `TEST-${Date.now()}`,
      userId: user.id,
      status: "AWAITING_PAYMENT",
      paymentMethod: "RAZORPAY",
      subtotal: plan.price,
      discount: 0,
      shippingFee: 0,
      total: plan.price,
      shippingAddress: {
        label: "OTHER",
        fullName: "Test Reader",
        phone: "9999999999",
        line1: "1 Test Lane",
        line2: null,
        landmark: null,
        city: "Hyderabad",
        state: "Telangana",
        pincode: "500001",
        lat: null,
        lng: null,
      },
      customerName: "Test Reader",
      customerEmail: EMAIL,
      customerPhone: "9999999999",
      reservedUntil: null,
      items: {
        create: [{ title: "The GenZ Times, 12 months", unitPrice: plan.price, quantity: 1 }],
      },
      payment: { create: { provider: "razorpay", status: "CREATED", amount: plan.price } },
      subscriptions: {
        create: {
          code: `SLPL-S-TEST-${Date.now().toString().slice(-5)}`,
          userId: user.id,
          subscriberName: "Test Reader",
          email: EMAIL,
          phone: "9999999999",
          addressLine1: "1 Test Lane",
          city: "Hyderabad",
          state: "Telangana",
          pincode: "500001",
          termMonths: plan.months,
          issuesTotal: plan.issues,
          amountPaid: plan.price,
          startIssue: "October 2026",
          endsAt: new Date("2027-09-01"),
        },
      },
    },
  });

  console.log("\nBefore payment");
  const before = await db.subscription.findFirstOrThrow({ where: { orderId: order.id } });
  check("subscription starts PENDING", before.status === "PENDING", before.status);
  check("no reservation on a subscription order", order.reservedUntil === null);

  console.log("\nPayment captured");
  await markOrderPaid(order.id, { via: "test", method: "test" });
  const paid = await db.subscription.findFirstOrThrow({ where: { orderId: order.id } });
  check("subscription is ACTIVE", paid.status === "ACTIVE", paid.status);
  check("startedAt was set", paid.startedAt !== null);

  const welcome = await db.emailLog.findMany({ where: { to: EMAIL } });
  check("welcome email sent", welcome.some((e) => e.template === "subscription-welcome"));
  check(
    "welcome email did not fail",
    welcome.every((e) => e.status === "SENT"),
    welcome.map((e) => `${e.template}:${e.status}`).join(", "),
  );
  const owner = await db.emailLog.findMany({ where: { template: "owner-new-subscription" } });
  check("owner was told", owner.length > 0);

  console.log("\nPaid twice (a webhook arriving late)");
  await markOrderPaid(order.id, { via: "test-repeat", method: "test" });
  const again = await db.emailLog.count({
    where: { to: EMAIL, template: "subscription-welcome" },
  });
  check("no second welcome email", again === 1, `${again} sent`);

  console.log("\nPosting issues");
  // The server actions call requireCapability, which reads a cookie and so
  // refuses outside a request. Exercise the writes they perform instead.
  const post = async (issueLabel: string) => {
    await db.$transaction(async (tx) => {
      await tx.subscriptionDispatch.create({ data: { subscriptionId: paid.id, issueLabel } });
      const s = await tx.subscription.update({
        where: { id: paid.id },
        data: { issuesSent: { increment: 1 } },
      });
      if (s.status === "ACTIVE" && s.issuesSent >= s.issuesTotal) {
        await tx.subscription.update({ where: { id: s.id }, data: { status: "COMPLETED" } });
      }
    });
  };

  await post("October 2026");
  await post("November 2026");
  let now = await db.subscription.findUniqueOrThrow({ where: { id: paid.id } });
  check("issuesSent moved to 2", now.issuesSent === 2, String(now.issuesSent));
  check("still ACTIVE mid term", now.status === "ACTIVE", now.status);

  let duplicate = false;
  try {
    await post("October 2026");
  } catch {
    duplicate = true;
  }
  now = await db.subscription.findUniqueOrThrow({ where: { id: paid.id } });
  check("posting the same issue twice is refused", duplicate);
  check("count unchanged after the refused post", now.issuesSent === 2, String(now.issuesSent));

  console.log("\nFinishing the term");
  for (let i = now.issuesSent; i < now.issuesTotal; i++) await post(`Issue ${i + 1}`);
  now = await db.subscription.findUniqueOrThrow({ where: { id: paid.id } });
  check("all 12 issues recorded", now.issuesSent === 12, String(now.issuesSent));
  check("term closes itself as COMPLETED", now.status === "COMPLETED", now.status);

  await cleanup();
  console.log(
    process.exitCode === 1 ? "\nSomething above failed.\n" : "\nEvery step passed. Cleaned up.\n",
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
