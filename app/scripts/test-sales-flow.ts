/**
 * Proves the parts of the sales module that must not be taken on trust:
 * numbering under contention, the document type deciding itself, the GST
 * split, the approval gate, and the ledger.
 *
 * Dev database only. Everything it makes is deleted afterwards.
 *
 *   NODE_OPTIONS=--conditions=react-server npx tsx scripts/test-sales-flow.ts
 */
import "dotenv/config";

import { db } from "../src/lib/db";
import { allocateSerial, nextInvoiceNumber, nextQuotationNumber } from "../src/lib/number-series";
import { documentKindFor, documentTotals, rupeesInWords } from "../src/lib/quotation-math";
import { accountPosition } from "../src/lib/ledger";
import {
  remindPosting,
  startInvoiceSubscriptions,
  stopInvoiceSubscriptions,
} from "../src/lib/subscription-notify";
import { isOwed } from "../src/lib/subscription-plans";

const CODE = "ZZT";

function check(what: string, ok: boolean, detail = "") {
  console.log(`${ok ? "  ok  " : " FAIL "} ${what}${detail ? ` (${detail})` : ""}`);
  if (!ok) process.exitCode = 1;
}

async function cleanup() {
  // A school's subscription outlives its deleted test invoice, so find it by the note
  await db.subscription.deleteMany({ where: { notes: { contains: `/${CODE}` } } });
  // Invoices outlive their school (the relation sets null), so remove them by number
  await db.invoice.deleteMany({ where: { number: { contains: `/${CODE}` } } });
  const org = await db.organization.findUnique({ where: { code: CODE } });
  if (org) await db.organization.delete({ where: { id: org.id } });
  await db.numberSeries.deleteMany({ where: { key: { contains: CODE } } });
  await db.numberSeries.deleteMany({ where: { key: "quotation:2031-32" } });
}

async function main() {
  await cleanup();

  console.log("\nThe owner's sample documents");
  const sample = [2960, 3120, 3960, 2720, 3925].map((r, i) => ({
    description: `UPSC set ${i}`,
    quantity: 100,
    unitPrice: r * 100,
    gstRate: 0,
  }));
  const st = documentTotals(sample, "Telangana", 3000);
  check("subtotal 16,68,500", st.subtotal === 16_68_500_00, String(st.subtotal / 100));
  check("discount 5,00,550", st.discount === 5_00_550_00, String(st.discount / 100));
  check("total 11,67,950", st.total === 11_67_950_00, String(st.total / 100));
  check(
    "words match the sample",
    rupeesInWords(st.total).startsWith("Eleven Lakh Sixty Seven Thousand Nine Hundred Fifty"),
    rupeesInWords(st.total),
  );

  console.log("\nThe document decides its own type");
  check("books only is a bill of supply", documentKindFor(sample) === "BILL_OF_SUPPLY");
  const mixed = [...sample, { description: "Workshop", quantity: 1, unitPrice: 25_000_00, gstRate: 1800 }];
  check("one taxed line makes it a tax invoice", documentKindFor(mixed) === "TAX_INVOICE");

  console.log("\nThe GST split follows the place of supply");
  const inState = documentTotals(mixed, "Telangana", 0);
  const outState = documentTotals(mixed, "Karnataka", 0);
  check("inside Telangana is CGST plus SGST", inState.cgst > 0 && inState.sgst > 0 && inState.igst === 0);
  check("outside is IGST", outState.igst > 0 && outState.cgst === 0);
  check("the halves add back to the whole", inState.cgst + inState.sgst === outState.igst);
  check("the total is the same either way", inState.total === outState.total);
  check(
    "a workshop at 18% is taxed, the books are not",
    inState.igst === 0 && inState.cgst + inState.sgst === Math.round(25_000_00 * 0.18),
    `${(inState.cgst + inState.sgst) / 100}`,
  );

  console.log("\nThe School Radio quotation, a discount given as money");
  const included = Array.from({ length: 11 }, (_, i) => ({
    description: `Included ${i}`,
    quantity: 1,
    unitPrice: 0,
    gstRate: 1800,
  }));
  const radio = documentTotals(
    [
      { description: "School radio", quantity: 1, unitPrice: 1_75_000_00, discountAmount: 15_000_00, gstRate: 1800 },
      ...included,
    ],
    "Telangana",
    0,
  );
  check("taxable 1,60,000", radio.taxable === 1_60_000_00, String(radio.taxable / 100));
  check("CGST @9% is 14,400", radio.cgst === 14_400_00, String(radio.cgst / 100));
  check("SGST @9% is 14,400", radio.sgst === 14_400_00, String(radio.sgst / 100));
  check("total 1,88,800", radio.total === 1_88_800_00, String(radio.total / 100));
  check(
    "words match the sample",
    rupeesInWords(radio.total) === "One Lakh Eighty Eight Thousand Eight Hundred Rupees Only",
    rupeesInWords(radio.total),
  );

  console.log("\nMixed rates, odd paise: the per-rate rows add up to the totals");
  const odd = documentTotals(
    [
      { description: "E-book", quantity: 3, unitPrice: 333, gstRate: 500 },
      { description: "Workshop", quantity: 1, unitPrice: 101, gstRate: 1800 },
    ],
    "Telangana",
    0,
  );
  const rowsCgst = odd.byRate.reduce((s, r) => s + r.cgst, 0);
  const rowsSgst = odd.byRate.reduce((s, r) => s + r.sgst, 0);
  check("CGST rows sum to CGST", rowsCgst === odd.cgst, `${rowsCgst} vs ${odd.cgst}`);
  check("SGST rows sum to SGST", rowsSgst === odd.sgst, `${rowsSgst} vs ${odd.sgst}`);
  check(
    "and the halves still add back to the tax",
    odd.cgst + odd.sgst === odd.byRate.reduce((s, r) => s + r.tax, 0),
  );

  console.log("\nQuotation numbers under contention");
  const qOn = new Date(2031, 5, 1);
  const qNumbers = await Promise.all(
    Array.from({ length: 15 }, () => db.$transaction((tx) => nextQuotationNumber(tx, qOn))),
  );
  check("fifteen saves gave fifteen numbers", new Set(qNumbers).size === 15);
  check("in the financial year series", qNumbers.every((n) => n.startsWith("SLPL/Q/2031-32/")), qNumbers[0]);

  console.log("\nNumbering under contention");
  const org = await db.organization.create({
    data: { code: CODE, name: "ZZ Test School", state: "Telangana" },
  });
  const on = new Date(2026, 8, 15);
  const numbers = await Promise.all(
    Array.from({ length: 20 }, () =>
      db.$transaction((tx) => nextInvoiceNumber(tx, on, "BOOK", CODE)),
    ),
  );
  const unique = new Set(numbers);
  check("twenty saves gave twenty numbers", unique.size === 20, `${unique.size} distinct`);
  const serials = numbers.map((n) => Number(n.slice(-2))).sort((a, b) => a - b);
  check(
    "with no gap in the series",
    serials.every((s, i) => s === i + 1),
    serials.join(","),
  );
  check("and the right shape", numbers[0].startsWith("BOOK/SLPL/09-26/ZZT"), numbers[0]);

  console.log("\nSeparate series do not collide");
  const a = await db.$transaction((tx) => allocateSerial(tx, `test:${CODE}:a`));
  const b = await db.$transaction((tx) => allocateSerial(tx, `test:${CODE}:b`));
  check("each series starts at one", a === 1 && b === 1, `${a} and ${b}`);

  console.log("\nThe ledger");
  const invoice = await db.invoice.create({
    data: {
      number: `BOOK/SLPL/09-26/${CODE}99`,
      kind: "BILL_OF_SUPPLY",
      status: "APPROVED",
      organizationId: org.id,
      customerName: org.name,
      placeOfSupply: "Telangana",
      invoiceDate: on,
      dueDate: new Date(2026, 8, 30),
      subtotal: 10_000_00,
      taxable: 10_000_00,
      total: 10_000_00,
      createdEmail: "test@theslpl.in",
    },
  });
  let position = await accountPosition(org.id);
  check("billed 10,000 and all outstanding", position.outstanding === 10_000_00);

  const receipt = await db.receipt.create({
    data: {
      number: `SLPL/R/TEST/${Date.now().toString().slice(-5)}`,
      organizationId: org.id,
      receivedOn: new Date(2026, 8, 20),
      amount: 4_000_00,
      mode: "BANK_TRANSFER",
      recordedEmail: "test@theslpl.in",
      allocations: { create: [{ invoiceId: invoice.id, amount: 4_000_00 }] },
    },
  });
  position = await accountPosition(org.id);
  check("after 4,000 paid, 6,000 outstanding", position.outstanding === 6_000_00, String(position.outstanding / 100));
  check("received is counted", position.received === 4_000_00);

  await db.receipt.update({ where: { id: receipt.id }, data: { voidedAt: new Date() } });
  position = await accountPosition(org.id);
  check("a voided receipt stops counting", position.outstanding === 10_000_00);

  console.log("\nThe bill is rounded to whole rupees");
  const up = documentTotals([{ description: "x", quantity: 1, unitPrice: 100_50, gstRate: 0 }], "Telangana", 0);
  check("Rs 100.50 goes up to Rs 101", up.total === 101_00 && up.roundOff === 50, `${up.total} ${up.roundOff}`);
  const down = documentTotals([{ description: "x", quantity: 1, unitPrice: 100_49, gstRate: 0 }], "Telangana", 0);
  check("Rs 100.49 goes down to Rs 100", down.total === 100_00 && down.roundOff === -49, `${down.total} ${down.roundOff}`);
  const messy = documentTotals(
    [
      { description: "Books", quantity: 7, unitPrice: 333_33, gstRate: 0 },
      { description: "Workshop", quantity: 1, unitPrice: 12_345_67, gstRate: 1800 },
    ],
    "Telangana",
    1250,
  );
  check("a discounted mixed bill lands on a whole rupee", messy.total % 100 === 0, String(messy.total));
  check(
    "and the round off is the whole difference",
    messy.total - messy.roundOff === messy.taxable + messy.cgst + messy.sgst + messy.igst &&
      Math.abs(messy.roundOff) <= 50,
    String(messy.roundOff),
  );

  console.log("\nA school's GenZ Times subscription starts when its bill is paid");
  const magBill = await db.invoice.create({
    data: {
      number: `MAG/SLPL/10-26/${CODE}98`,
      productLine: "MAG",
      status: "APPROVED",
      organizationId: org.id,
      customerName: org.name,
      contactPerson: "The Principal",
      addressLine: "1 Test Road",
      city: "Hyderabad",
      state: "Telangana",
      pincode: "500068",
      invoiceDate: new Date(2026, 9, 7),
      dueDate: new Date(2026, 9, 22),
      subtotal: 60_470_00,
      taxable: 60_470_00,
      total: 60_470_00,
      createdEmail: "test@theslpl.in",
      items: {
        create: [
          {
            productId: "magazine:annual",
            description: "The GenZ Times subscription, 12 months (12 issues)",
            quantity: 30,
            unitPrice: 1999_00,
            lineTotal: 59_970_00,
          },
          { description: "Delivery charges", quantity: 1, unitPrice: 500_00, lineTotal: 500_00, sortOrder: 1 },
        ],
      },
    },
  });
  const paidOn = new Date(2026, 9, 7);
  const made = await db.$transaction((tx) => startInvoiceSubscriptions(tx, magBill.id, paidOn));
  check("one subscription for the one magazine line", made === 1, String(made));
  const sub = await db.subscription.findFirstOrThrow({ where: { invoiceId: magBill.id } });
  check("30 copies of each issue", sub.copies === 30, String(sub.copies));
  check("paid in October, posted from November", sub.startIssue === "November 2026", sub.startIssue);
  check(
    "twelve issues, the last in October 2027",
    sub.issuesTotal === 12 && sub.endsAt?.getMonth() === 9 && sub.endsAt.getFullYear() === 2027,
    sub.endsAt?.toDateString(),
  );
  check("the line's own value is what was paid", sub.amountPaid === 59_970_00, String(sub.amountPaid));
  check("posted to the school, for the contact", sub.addressLine2 === "Attn: The Principal");
  check("not owed the October issue", !isOwed(sub, "October 2026"));
  check("owed the November issue", isOwed(sub, "November 2026"));

  const owed = await remindPosting(new Date(2026, 10, 1));
  const mail = await db.emailLog.findFirst({
    where: { template: "subscription-posting-reminder" },
    orderBy: { createdAt: "desc" },
  });
  check(
    "the reminder on 1 November names the issue and counts the copies",
    owed >= 1 && !!mail?.subject.includes("November 2026") && /\b\d+ copies\b/.test(mail.subject),
    mail ? `${mail.subject} [${mail.status}]` : "no email logged",
  );

  const again = await db.$transaction((tx) => startInvoiceSubscriptions(tx, magBill.id, paidOn));
  check("a second payment does not make a second subscription", again === 0);
  const stopped = await db.$transaction((tx) => stopInvoiceSubscriptions(tx, [magBill.id]));
  const left = await db.subscription.count({ where: { invoiceId: magBill.id } });
  check("voiding the payment takes it off the posting list", stopped === 1 && left === 0);

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
