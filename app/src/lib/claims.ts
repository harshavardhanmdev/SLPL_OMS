/** What staff claim for, worded as they would say it. Values are Expense categories. */
export const CLAIM_CATEGORIES = [
  { value: "TRAVEL", label: "Travel" },
  { value: "FUEL", label: "Fuel" },
  { value: "MEALS", label: "Food" },
  { value: "MISC", label: "Other" },
] as const;

export type ClaimCategory = (typeof CLAIM_CATEGORIES)[number]["value"];

export const claimCategoryLabel = (value: string) =>
  CLAIM_CATEGORIES.find((c) => c.value === value)?.label ?? value;
