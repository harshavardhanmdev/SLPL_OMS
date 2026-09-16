/**
 * Expense vocabulary, shared by the server and the client form.
 * No database or env access, so the mobile form can import it directly.
 */

export const EXPENSE_CATEGORIES = [
  { value: "FUEL", label: "Fuel and petrol" },
  { value: "TRAVEL", label: "Travel and conveyance" },
  { value: "STATIONERY", label: "Stationery" },
  { value: "PRINTING", label: "Printing and binding" },
  { value: "COURIER", label: "Courier and postage" },
  { value: "OFFICE", label: "Office supplies" },
  { value: "UTILITIES", label: "Electricity, water, internet" },
  { value: "RENT", label: "Rent" },
  { value: "REPAIRS", label: "Repairs and maintenance" },
  { value: "PROFESSIONAL_FEES", label: "Professional fees" },
  { value: "SALARIES", label: "Salaries and wages" },
  { value: "MARKETING", label: "Marketing and advertising" },
  { value: "MEALS", label: "Meals and hospitality" },
  { value: "BANK_CHARGES", label: "Bank charges" },
  { value: "MISC", label: "Miscellaneous" },
] as const;

export const PAID_FROM = [
  { value: "CURRENT_ACCOUNT", label: "Current account" },
  { value: "CASH", label: "Cash" },
  { value: "CARD", label: "Card" },
  { value: "UPI", label: "UPI" },
  { value: "CHEQUE", label: "Cheque" },
] as const;

export type ExpenseCategoryValue = (typeof EXPENSE_CATEGORIES)[number]["value"];
export type PaidFromValue = (typeof PAID_FROM)[number]["value"];

export function categoryLabel(value: string): string {
  return EXPENSE_CATEGORIES.find((c) => c.value === value)?.label ?? value;
}

export function paidFromLabel(value: string): string {
  return PAID_FROM.find((p) => p.value === value)?.label ?? value;
}

export function isExpenseCategory(value: string): value is ExpenseCategoryValue {
  return EXPENSE_CATEGORIES.some((c) => c.value === value);
}

export function isPaidFrom(value: string): value is PaidFromValue {
  return PAID_FROM.some((p) => p.value === value);
}

/**
 * The Indian financial year a date falls in: 1 April to 31 March.
 * Auditors ask for a financial year, never a calendar year.
 */
export function financialYearOf(date: Date): { label: string; start: Date; end: Date } {
  const startYear = date.getMonth() >= 3 ? date.getFullYear() : date.getFullYear() - 1;
  return {
    label: `${startYear}-${String((startYear + 1) % 100).padStart(2, "0")}`,
    start: new Date(startYear, 3, 1),
    end: new Date(startYear + 1, 2, 31, 23, 59, 59, 999),
  };
}
