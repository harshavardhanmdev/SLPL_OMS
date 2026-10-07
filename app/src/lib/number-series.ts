import "server-only";

import type { Prisma } from "@/generated/prisma/client";

/**
 * Allocating a document number that must never repeat and never skip.
 *
 * The quotation used to find the highest number with a plain SELECT and add
 * one, which hands two people saving at the same moment the same number. On a
 * quotation that is embarrassing. On a GST invoice it is a compliance problem,
 * because Rule 46(b) wants one continuous series and an auditor reads a gap as
 * a suppressed sale.
 *
 * So: insert the row if it is missing, then take a row lock on it, then
 * increment. The lock is held until the caller's transaction commits, so the
 * number and the document it belongs to are written or abandoned together.
 * Two concurrent callers queue; neither sees the other's number.
 */

type Tx = Prisma.TransactionClient;

/**
 * The next serial for `key`, locked for the life of the transaction.
 *
 * MUST be called inside `db.$transaction`, otherwise the lock is released
 * immediately and the guarantee is gone.
 */
export async function allocateSerial(tx: Tx, key: string): Promise<number> {
  // Create the series on first use without upsetting a concurrent creator
  await tx.$executeRaw`
    INSERT INTO "NumberSeries" ("key", "next", "updatedAt")
    VALUES (${key}, 1, NOW())
    ON CONFLICT ("key") DO NOTHING
  `;

  const locked = await tx.$queryRaw<{ next: number }[]>`
    SELECT "next" FROM "NumberSeries" WHERE "key" = ${key} FOR UPDATE
  `;
  const serial = locked[0]?.next ?? 1;

  await tx.$executeRaw`
    UPDATE "NumberSeries" SET "next" = ${serial + 1}, "updatedAt" = NOW()
    WHERE "key" = ${key}
  `;
  return serial;
}

/** `2026-27` from a date, the Indian financial year starting in April. */
export function financialYearLabel(date: Date): string {
  const startYear = date.getMonth() >= 3 ? date.getFullYear() : date.getFullYear() - 1;
  return `${startYear}-${String((startYear + 1) % 100).padStart(2, "0")}`;
}

/** `09-26` from a date, as the owner's invoice samples write it. */
export function monthYearLabel(date: Date): string {
  return `${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getFullYear()).slice(2)}`;
}

const pad = (n: number, width: number) => String(n).padStart(width, "0");

/**
 * `SLPL/Q/2026-27/GLO/0001`
 *
 * The school's code says who it is for at a glance, as on an invoice, while
 * the serial still runs across every school in the financial year.
 */
export async function nextQuotationNumber(tx: Tx, on: Date, customerCode: string): Promise<string> {
  const fy = financialYearLabel(on);
  return `SLPL/Q/${fy}/${customerCode}/${pad(await allocateSerial(tx, `quotation:${fy}`), 4)}`;
}

/**
 * `MAG/SLPL/09-26/CAM01`
 *
 * The serial runs per customer per product line, which is what the owner's
 * samples show, so a school's invoices read 01, 02, 03 rather than jumping
 * around with everyone else's.
 */
export async function nextInvoiceNumber(
  tx: Tx,
  on: Date,
  productLine: string,
  customerCode: string,
): Promise<string> {
  const my = monthYearLabel(on);
  const serial = await allocateSerial(tx, `invoice:${productLine}:${customerCode}`);
  // GLO2-01 rather than GLO201, so a code ending in a digit still reads apart from its serial
  const join = /\d$/.test(customerCode) ? "-" : "";
  return `${productLine}/SLPL/${my}/${customerCode}${join}${pad(serial, 2)}`;
}

/** `SLPL/DC/2026-27/0001` */
export async function nextChallanNumber(tx: Tx, on: Date): Promise<string> {
  const fy = financialYearLabel(on);
  return `SLPL/DC/${fy}/${pad(await allocateSerial(tx, `challan:${fy}`), 4)}`;
}

/** `SLPL/R/2026-27/0001` */
export async function nextReceiptNumber(tx: Tx, on: Date): Promise<string> {
  const fy = financialYearLabel(on);
  return `SLPL/R/${fy}/${pad(await allocateSerial(tx, `receipt:${fy}`), 4)}`;
}
