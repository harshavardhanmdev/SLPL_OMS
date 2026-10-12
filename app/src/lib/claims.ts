/**
 * What staff claim for, worded as they would say it. The values and labels are
 * the Team Expenses app's own, so a bill reads the same in both places; each
 * also names the Expense category it is counted under here.
 */
export const CLAIM_CATEGORIES = [
  { value: "TRAVEL", label: "Travel / Tickets", ledger: "TRAVEL" },
  { value: "HOTEL", label: "Hotel / Stay", ledger: "TRAVEL" },
  { value: "FOOD", label: "Food & Meals", ledger: "MEALS" },
  { value: "LOCAL_TRANSPORT", label: "Local Transport", ledger: "TRAVEL" },
  { value: "FUEL", label: "Fuel", ledger: "FUEL" },
  { value: "OFFICE", label: "Office Supplies", ledger: "STATIONERY" },
  { value: "CLIENT", label: "Client Entertainment", ledger: "MARKETING" },
  { value: "COMMUNICATION", label: "Phone / Internet", ledger: "UTILITIES" },
  { value: "OTHER", label: "Other", ledger: "MISC" },
] as const;

export type ClaimCategory = (typeof CLAIM_CATEGORIES)[number]["value"];

/** How the person paid, as the app records it. */
export const PAYMENT_MODES = [
  { value: "CASH", label: "Cash" },
  { value: "UPI", label: "UPI" },
  { value: "CARD", label: "Personal Card" },
  { value: "COMPANY_CARD", label: "Company Card" },
  { value: "OTHER", label: "Other" },
] as const;

/** Claims from before the app's categories carry only a ledger head. */
const OLD_LABELS: Record<string, string> = { TRAVEL: "Travel", FUEL: "Fuel", MEALS: "Food", MISC: "Other" };

export const claimCategoryLabel = (category: string, appCategory?: string | null) =>
  CLAIM_CATEGORIES.find((c) => c.value === appCategory)?.label ?? OLD_LABELS[category] ?? category;

/** The ledger head a claim in this app category is counted under. */
export const ledgerFor = (appCategory: string) =>
  CLAIM_CATEGORIES.find((c) => c.value === appCategory)?.ledger ?? "MISC";

/** The app category for an older claim that has only a ledger head. */
export const appCategoryFor = (category: string) =>
  ({ TRAVEL: "TRAVEL", FUEL: "FUEL", MEALS: "FOOD" })[category] ?? "OTHER";

export const paymentModeLabel = (value: string | null | undefined) =>
  PAYMENT_MODES.find((m) => m.value === value)?.label ?? null;
