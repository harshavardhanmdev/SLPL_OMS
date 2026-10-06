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
import { allocateSerial, nextInvoiceNumber } from "../src/lib/number-series";
import { documentKindFor, documentTotals, rupeesInWords } from "../src/lib/quotation-math";
import { accountPosition } from "../src/lib/ledger";

const CODE = "ZZT";

function check(what: string, ok: boolean, detail = "") {
  console.log(`${ok ? "  ok  " : " FAIL "} ${what}${detail ? ` (${detail})` : ""}`);
  if (!ok) process.exitCode = 1;
}

async function cleanup() {
  const org = await db.organization.findUnique({ where: { code: CODE } });
  if (org) await db.organization.delete({ where: { id: org.id } });
  await db.numberSeries.deleteMany({ where: { key: { contains: CODE } } });
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
