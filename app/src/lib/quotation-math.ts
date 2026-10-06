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
  /** Basis points of GST: 0 for a printed book, 500 for an e-book, 1800 for a service. */
  gstRate: number;
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
  const discount = Math.round((gross * Math.max(0, line.discountBp ?? 0)) / 10000);
  const taxable = gross - discount;
  const tax = Math.round((taxable * Math.max(0, line.gstRate)) / 10000);
  return { gross, discount, taxable, tax, total: taxable + tax };
}

export type QuoteTotals = {
  subtotal: number;
  discount: number;
  taxable: number;
  cgst: number;
  sgst: number;
  igst: number;
  total: number;
  /** Tax split by rate, which is what a GST-registered buyer wants to see. */
  byRate: { rate: number; taxable: number; tax: number }[];
  interState: boolean;
};

/**
 * Within Telangana a supply is CGST plus SGST, half each. Anywhere else it is
 * IGST at the full rate. Getting this the wrong way round is the single most
 * common mistake on an Indian quotation.
 */
export function quoteTotals(lines: QuoteLine[], placeOfSupply: string): QuoteTotals {
  const interState = placeOfSupply.trim().toLowerCase() !== OUR_STATE.toLowerCase();

  let subtotal = 0;
  let discount = 0;
  let taxable = 0;
  let tax = 0;
  const rates = new Map<number, { taxable: number; tax: number }>();

  for (const line of lines) {
    const t = lineTotals(line);
    subtotal += t.gross;
    discount += t.discount;
    taxable += t.taxable;
    tax += t.tax;
    const bucket = rates.get(line.gstRate) ?? { taxable: 0, tax: 0 };
    bucket.taxable += t.taxable;
    bucket.tax += t.tax;
    rates.set(line.gstRate, bucket);
  }

  // Split once on the total rather than per line, so the halves always add back
  const cgst = interState ? 0 : Math.round(tax / 2);
  const sgst = interState ? 0 : tax - cgst;
  const igst = interState ? tax : 0;

  return {
    subtotal,
    discount,
    taxable,
    cgst,
    sgst,
    igst,
    total: taxable + tax,
    byRate: [...rates.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([rate, v]) => ({ rate, ...v })),
    interState,
  };
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
