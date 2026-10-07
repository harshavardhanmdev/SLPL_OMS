/**
 * Starts the GenZ Times subscription for invoices paid before a paid bill did
 * that by itself, or whose subscription line was typed by hand rather than
 * picked, such as "The Genz Times Annual Subscription".
 *
 * Each typed line is read as its plan and remembered on the line, then the
 * subscription starts from the month after the payment that settled the bill.
 * Safe to run twice: an invoice that already has its subscription is skipped.
 *
 *   NODE_OPTIONS=--conditions=react-server npx tsx scripts/backfill-invoice-subscriptions.ts          (dry run)
 *   NODE_OPTIONS=--conditions=react-server npx tsx scripts/backfill-invoice-subscriptions.ts --apply
 */
import "dotenv/config";

import { db } from "../src/lib/db";
import { lineProductId } from "../src/lib/quoting";
import { startInvoiceSubscriptions } from "../src/lib/subscription-notify";

const apply = process.argv.includes("--apply");

async function main() {
  const invoices = await db.invoice.findMany({
    where: { status: "PAID", subscriptions: { none: {} } },
    include: { items: true, allocations: { include: { receipt: true } } },
  });

  let started = 0;
  for (const invoice of invoices) {
    const typed = invoice.items
      .filter((i) => !i.productId)
      .map((i) => ({ item: i, productId: lineProductId(null, i.description) }))
      .filter((x) => x.productId);
    const magazine = invoice.items.filter((i) => i.productId?.startsWith("magazine:")).length + typed.length;
    if (magazine === 0) continue;

    // The bill became paid with its latest payment, so delivery runs from the month after that
    const live = invoice.allocations.filter((a) => !a.receipt.voidedAt);
    const paidOn = new Date(Math.max(...live.map((a) => a.receipt.receivedOn.getTime())));
    console.log(
      `${invoice.number} ${invoice.customerName}: ${magazine} subscription line(s), paid ${paidOn.toDateString()}` +
        typed.map((x) => `\n  typed "${x.item.description}" read as ${x.productId}`).join(""),
    );
    if (!apply) continue;

    const made = await db.$transaction(async (tx) => {
      for (const x of typed) {
        await tx.invoiceItem.update({ where: { id: x.item.id }, data: { productId: x.productId } });
      }
      return startInvoiceSubscriptions(tx, invoice.id, paidOn);
    });
    started += made;
    console.log(`  started ${made}`);
  }
  console.log(apply ? `\nStarted ${started} subscription(s).` : "\nDry run. Add --apply to start them.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
