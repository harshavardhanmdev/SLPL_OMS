/**
 * What a quotation adds up to.
 *
 * Client safe, so the form and the server compute the same figures and the
 * price a school is shown is the price the server stores.
 *
 * All money is paise. Percentages are basis points, so 18% is 1800 and 12.5%
 * is 1250, which keeps GST exact without touching a float.
 */

export const OUR_STATE = "Telangana";

export type QuoteLine = {
  description: string;
  hsnCode?: string | null;
  unit?: string;
  quantity: number;
  /** Paise per unit, before discount. */
  unitPrice: number;
  /** Basis points off this line. */
  discountBp?: number;
  /** Paise off the whole line. Wins over the percentage when set. */
  discountAmount?: number;
  /** Basis points of GST: 0 for a printed book, 500 for an e-book, 1800 for a service. */
  gstRate: number;
  /** Outside the bill discount, such as a delivery charge. */
  noBillDiscount?: boolean;
};

export type QuoteLineTotals = {
  gross: number;
  discount: number;
  taxable: number;
  tax: number;
  total: number;
};

export function lineTotals(line: QuoteLine): QuoteLineTotals {
  const gross = Math.max(0, Math.round(line.unitPrice * Math.max(0, line.quantity)));
  // An amount is taken as given, because Rs 15,000 off Rs 1,75,000 is 8.5714%
  // and no whole number of basis points lands back on Rs 15,000
  const discount =
    (line.discountAmount ?? 0) > 0
      ? Math.min(gross, Math.round(line.discountAmount ?? 0))
      : Math.round((gross * Math.max(0, line.discountBp ?? 0)) / 10000);
  const taxable = gross - discount;
  const tax = Math.round((taxable * Math.max(0, line.gstRate)) / 10000);
  return { gross, discount, taxable, tax, total: taxable + tax };
}

/**
 * One line once the bill discount has taken its share, so a printed line's
 * DISC, TAX and AMOUNT columns add up to the totals beneath them.
 */
export function discountedLine(line: QuoteLine, billDiscountBp: number): QuoteLineTotals {
  const t = lineTotals(line);
  const keep = 1 - Math.min(10000, Math.max(0, billDiscountBp)) / 10000;
  // A delivery or other charge is billed in full, whatever the discount on the books
  const net = line.noBillDiscount ? t.taxable : Math.round(t.taxable * keep);
  const tax = Math.round((net * Math.max(0, line.gstRate)) / 10000);
  return { gross: t.gross, discount: t.gross - net, taxable: net, tax, total: net + tax };
}

export type QuoteTotals = {
  subtotal: number;
  discount: number;
  taxable: number;
  cgst: number;
  sgst: number;
  igst: number;
  /** Taxable plus tax, rounded to whole rupees. */
  total: number;
  /** What the rounding added or took away, paise. Printed as "Round off". */
  roundOff: number;
  /** Tax split by rate, which is what a GST-registered buyer wants to see. */
  byRate: { rate: number; taxable: number; tax: number; cgst: number; sgst: number }[];
  interState: boolean;
};

/**
 * Within Telangana a supply is CGST plus SGST, half each. Anywhere else it is
 * IGST at the full rate. Getting this the wrong way round is the single most
 * common mistake on an Indian quotation.
 */
export function quoteTotals(lines: QuoteLine[], placeOfSupply: string): QuoteTotals {
  return documentTotals(lines, placeOfSupply, 0);
}

/**
 * The same arithmetic with a flat percentage taken off the whole bill, which
 * is how the owner's sample invoice works: five lines at list price, then 30%
 * off the lot.
 *
 * The bill discount is spread across the rate buckets in proportion to their
 * taxable value, so a mixed bill of nil-rated books and an 18% workshop taxes
 * each at the right rate on its own discounted share. Taking it off the total
 * instead would quietly overcharge or undercharge the tax.
 */
export function documentTotals(
  lines: QuoteLine[],
  placeOfSupply: string,
  billDiscountBp: number,
): QuoteTotals {
  const interState = placeOfSupply.trim().toLowerCase() !== OUR_STATE.toLowerCase();

  let subtotal = 0;
  let discount = 0;
  let taxable = 0;
  let tax = 0;
  const rates = new Map<number, { taxable: number; tax: number }>();

  for (const line of lines) {
    const d = discountedLine(line, billDiscountBp);
    subtotal += d.gross;
    discount += d.discount;
    taxable += d.taxable;
    tax += d.tax;
    const bucket = rates.get(line.gstRate) ?? { taxable: 0, tax: 0 };
    bucket.taxable += d.taxable;
    bucket.tax += d.tax;
    rates.set(line.gstRate, bucket);
  }

  // Halve each rate's tax on its own, so the "CGST @9%" and "CGST @2.5%" rows
  // printed on a document add up to the CGST total exactly
  const byRate = [...rates.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([rate, v]) => {
      const half = interState ? 0 : Math.round(v.tax / 2);
      return { rate, ...v, cgst: half, sgst: interState ? 0 : v.tax - half };
    });
  const cgst = byRate.reduce((sum, r) => sum + r.cgst, 0);
  const sgst = byRate.reduce((sum, r) => sum + r.sgst, 0);
  const igst = interState ? tax : 0;

  // A bill is settled in whole rupees: 50 paise and above goes up, below goes down
  const exact = taxable + tax;
  const total = Math.round(exact / 100) * 100;

  return {
    subtotal,
    discount,
    taxable,
    cgst,
    sgst,
    igst,
    total,
    roundOff: total - exact,
    byRate,
    interState,
  };
}

/**
 * Nil rated throughout is a Bill of Supply. One taxed line makes it a Tax
 * Invoice. Decided from the lines rather than offered as a dropdown, because
 * picking the wrong one is the error that surfaces in an audit years later.
 */
export function documentKindFor(lines: { gstRate: number }[]) {
  return lines.some((l) => l.gstRate > 0) ? ("TAX_INVOICE" as const) : ("BILL_OF_SUPPLY" as const);
}

/**
 * The owner's usual codes: HSN 4901 for a printed book, SAC 9983 for a taxed
 * service. Changing a line's GST swaps one for the other, so a new line reads
 * right either way, but a code typed by hand is left alone.
 */
export const BOOK_HSN = "4901";
export const SERVICE_SAC = "9983";

export function hsnForRate(current: string, gstRate: number): string {
  if (current === BOOK_HSN && gstRate > 0) return SERVICE_SAC;
  if (current === SERVICE_SAC && gstRate === 0) return BOOK_HSN;
  return current;
}

/** "18%" from 1800, and "12.5%" from 1250, without trailing zeros. */
export function ratePercent(basisPoints: number): string {
  return `${(basisPoints / 100).toFixed(2).replace(/\.?0+$/, "")}%`;
}

const ONES = [
  "",
  "One",
  "Two",
  "Three",
  "Four",
  "Five",
  "Six",
  "Seven",
  "Eight",
  "Nine",
  "Ten",
  "Eleven",
  "Twelve",
  "Thirteen",
  "Fourteen",
  "Fifteen",
  "Sixteen",
  "Seventeen",
  "Eighteen",
  "Nineteen",
];
const TENS = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

function underThousand(n: number): string {
  if (n === 0) return "";
  if (n < 20) return ONES[n];
  if (n < 100) return `${TENS[Math.floor(n / 10)]}${n % 10 ? ` ${ONES[n % 10]}` : ""}`;
  return `${ONES[Math.floor(n / 100)]} Hundred${n % 100 ? ` ${underThousand(n % 100)}` : ""}`;
}

/**
 * Rupees in words, Indian grouping, because an Indian quotation is expected to
 * carry the amount in words under the total.
 */
export function rupeesInWords(paise: number): string {
  const rupees = Math.floor(Math.abs(paise) / 100);
  const remainder = Math.abs(paise) % 100;
  if (rupees === 0 && remainder === 0) return "Zero Rupees Only";

  const groups: [number, string][] = [
    [10000000, "Crore"],
    [100000, "Lakh"],
    [1000, "Thousand"],
  ];
  let left = rupees;
  const parts: string[] = [];
  for (const [value, name] of groups) {
    const count = Math.floor(left / value);
    if (count > 0) {
      parts.push(`${underThousand(count)} ${name}`);
      left -= count * value;
    }
  }
  if (left > 0) parts.push(underThousand(left));

  const words = parts.join(" ").trim();
  const paiseWords = remainder > 0 ? ` and ${underThousand(remainder)} Paise` : "";
  return `${words || "Zero"} Rupees${paiseWords} Only`;
}
