/**
 * How a school paid, with the words accounts actually use. Shared by the
 * payment form and the payments list, so the two never label a mode
 * differently.
 */
export const PAYMENT_MODES = [
  ["BANK_TRANSFER", "Bank transfer (NEFT, RTGS, IMPS)"],
  ["UPI", "UPI"],
  ["CHEQUE", "Cheque"],
  ["CASH", "Cash"],
  ["CARD", "Card"],
  ["RAZORPAY", "Razorpay"],
  ["OTHER", "Something else"],
] as const;

export type PaymentModeValue = (typeof PAYMENT_MODES)[number][0];

export const PAYMENT_MODE_LABEL: Record<string, string> = Object.fromEntries(PAYMENT_MODES);
