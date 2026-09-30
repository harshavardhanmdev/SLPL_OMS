/**
 * Walks a digital edition through the life it will really have: bought, paid,
 * licensed, watermarked, and not licensed twice.
 *
 * Dev database only. It creates a throwaway reader and a throwaway edition,
 * then deletes everything it made, so it can be run as often as needed.
 *
 *   NODE_OPTIONS=--conditions=react-server npx tsx scripts/test-digital-flow.ts
 */
import "dotenv/config";

import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

import { db } from "../src/lib/db";
import { markOrderPaid } from "../src/lib/orders";
import { EDITIONS_DIR, findLicence, grantEntitlement, renderPage } from "../src/lib/digital-access";

const EMAIL = "digital-test@theslpl.in";
const SLUG = "test-digital-edition";
const EDITION_KEY = "test-digital-edition";

function check(label: string, ok: boolean, detail = "") {
  console.log(`${ok ? "  ok  " : " FAIL "} ${label}${detail ? ` (${detail})` : ""}`);
  if (!ok) process.exitCode = 1;
}

async function cleanup() {
  const user = await db.user.findUnique({ where: { email: EMAIL } });
  if (user) {
    const orders = await db.order.findMany({ where: { userId: user.id }, select: { id: true } });
    const ids = orders.map((o) => o.id);
    await db.digitalEntitlement.deleteMany({ where: { userId: user.id } });
    await db.orderEvent.deleteMany({ where: { orderId: { in: ids } } });
    await db.orderItem.deleteMany({ where: { orderId: { in: ids } } });
    await db.payment.deleteMany({ where: { orderId: { in: ids } } });
    await db.order.deleteMany({ where: { id: { in: ids } } });
    await db.emailLog.deleteMany({ where: { to: EMAIL } });
    await db.notification.deleteMany({ where: { userId: user.id } });
    await db.user.delete({ where: { id: user.id } });
  }
  await db.product.deleteMany({ where: { slug: SLUG } });
  await rm(path.join(EDITIONS_DIR, EDITION_KEY), { recursive: true, force: true });
}

async function main() {
  await cleanup();

  // Two blank pages standing in for a real issue
  const dir = path.join(EDITIONS_DIR, EDITION_KEY);
  await mkdir(dir, { recursive: true });
  for (const n of [1, 2]) {
    const page = await sharp({
      create: { width: 900, height: 1160, channels: 3, background: "#ffffff" },
    })
      .webp()
      .toBuffer();
    await writeFile(path.join(dir, `p${String(n).padStart(3, "0")}.webp`), page);
  }

  const category = await db.category.findFirstOrThrow();
  const product = await db.product.create({
    data: {
      slug: SLUG,
      title: "Test Digital Edition",
      kind: "DIGITAL",
      categoryId: category.id,
      description: "Throwaway.",
      mrp: 12600,
      price: 12600,
      stock: 0,
      weightGrams: 0,
      pageCount: 2,
      editionKey: EDITION_KEY,
      isVisible: true,
      gstRate: 500,
      hsnCode: "4901",
    },
  });
  const user = await db.user.create({
    data: {
      email: EMAIL,
      name: "Test Reader",
      phone: "9999999999",
      passwordHash: "x",
      emailVerified: new Date(),
    },
  });

  console.log("\nBefore payment");
  check("nobody can read it yet", (await findLicence(user.id, SLUG)) === null);

  const order = await db.order.create({
    data: {
      orderNumber: `TESTD-${Date.now()}`,
      userId: user.id,
      status: "AWAITING_PAYMENT",
      paymentMethod: "RAZORPAY",
      subtotal: product.price,
      discount: 0,
      shippingFee: 0,
      total: product.price,
      shippingAddress: {
        label: "OTHER",
        fullName: "Test Reader",
        phone: "9999999999",
        line1: "Digital edition, read online",
        line2: product.title,
        landmark: null,
        city: "-",
        state: "-",
        pincode: "-",
        lat: null,
        lng: null,
      },
      customerName: "Test Reader",
      customerEmail: EMAIL,
      customerPhone: "9999999999",
      reservedUntil: null,
      items: {
        create: [
          { productId: product.id, title: product.title, unitPrice: product.price, quantity: 1 },
        ],
      },
      payment: { create: { provider: "razorpay", status: "CREATED", amount: product.price } },
    },
  });
  check("no reservation on a stockless order", order.reservedUntil === null);

  console.log("\nPayment captured");
  await markOrderPaid(order.id, { via: "test", method: "test" });

  const licence = await findLicence(user.id, SLUG);
  check("the reader is licensed", licence !== null);
  check("the licence code is theirs", Boolean(licence?.code.startsWith("SLPL-D-")), licence?.code);

  const mails = await db.emailLog.findMany({ where: { to: EMAIL } });
  check("the ready-to-read email went", mails.some((m) => m.template === "digital-ready"));
  check(
    "no email failed",
    mails.every((m) => m.status === "SENT"),
    mails.map((m) => `${m.template}:${m.status}`).join(", "),
  );
  check(
    "no packing email was sent",
    !mails.some((m) => m.template === "order-paid"),
  );

  const after = await db.product.findUniqueOrThrow({ where: { id: product.id } });
  check("stock never moved", after.stock === 0, String(after.stock));

  console.log("\nPaid twice (a webhook arriving late)");
  await markOrderPaid(order.id, { via: "test-repeat", method: "test" });
  const licences = await db.digitalEntitlement.count({ where: { userId: user.id } });
  check("still exactly one licence", licences === 1, String(licences));

  console.log("\nPaying again for the same issue");
  const again = await grantEntitlement({ userId: user.id, productId: product.id });
  check("the second grant reuses the first", again.created === false);
  check("and keeps the same code", again.code === licence?.code);

  console.log("\nThe watermark");
  const png = await sharp(await renderPage(licence!, 1)).png().toBuffer();
  const { data, info } = await sharp(png)
    .extract({ left: 0, top: 1100, width: 900, height: 60 })
    .greyscale()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const darkPixels = data.filter((v) => v < 120).length;
  check(
    "the footer is stamped on the page",
    darkPixels > info.width,
    `${darkPixels} dark pixels in the footer band`,
  );

  console.log("\nSomebody else's copy");
  const stranger = await db.user.create({
    data: { email: `other-${Date.now()}@theslpl.in`, name: "Stranger", passwordHash: "x" },
  });
  check("a stranger gets no licence", (await findLicence(stranger.id, SLUG)) === null);
  await db.user.delete({ where: { id: stranger.id } });

  console.log("\nAfter access is withdrawn");
  await db.digitalEntitlement.updateMany({
    where: { userId: user.id },
    data: { revokedAt: new Date(), revokeReason: "test" },
  });
  check("a withdrawn licence cannot read", (await findLicence(user.id, SLUG)) === null);

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
