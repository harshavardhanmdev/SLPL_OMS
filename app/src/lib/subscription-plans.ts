/**
 * The GenZ Times subscription plans.
 *
 * Prepaid terms rather than auto-renewal: the reader pays once for a fixed
 * number of issues and we post each one as it prints. No mandate to manage, and
 * it reuses the Razorpay flow already carrying live orders.
 *
 * Client-safe, so the subscribe form and the server both read one definition
 * and the price a reader is shown is the price the server charges.
 */

export const COVER_PRICE = 23400; // paise, the printed cover price

export type Plan = {
  id: "quarterly" | "half-year" | "annual";
  label: string;
  months: number;
  issues: number;
  /** What the same issues cost one at a time, for an honest strike-through. */
  listPrice: number;
  price: number;
  blurb: string;
  popular?: boolean;
};

export const PLANS: Plan[] = [
  {
    id: "quarterly",
    label: "3 months",
    months: 3,
    issues: 3,
    listPrice: COVER_PRICE * 3,
    price: 65000,
    blurb: "Try it for a term.",
  },
  {
    id: "half-year",
    label: "6 months",
    months: 6,
    issues: 6,
    listPrice: COVER_PRICE * 6,
    price: 119900,
    blurb: "Six issues, posted as they print.",
  },
  {
    id: "annual",
    label: "12 months",
    months: 12,
    issues: 12,
    listPrice: COVER_PRICE * 12,
    price: 199900,
    blurb: "A full year, and the best price per issue.",
    popular: true,
  },
];

export function planById(id: string): Plan | undefined {
  return PLANS.find((p) => p.id === id);
}

export function savingsPercent(plan: Plan): number {
  return Math.round(((plan.listPrice - plan.price) / plan.listPrice) * 100);
}

/** Rounded to whole rupees: this is a comparison, never a price we charge. */
export function perIssue(plan: Plan): number {
  return Math.round(plan.price / plan.issues / 100) * 100;
}

/** The cutoff for "this term is running out", used to count renewals due. */
export function endsWithin(days: number): Date {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
}

/** The issue of a given month, spelled the one way everything else spells it. */
export function issueLabelFor(d = new Date()): string {
  return d.toLocaleDateString("en-IN", { month: "long", year: "numeric" });
}

/**
 * The issue a subscription starting today should begin with.
 *
 * The month's issue is considered printed once we are past the 25th, so a
 * reader subscribing at the end of September starts with October rather than
 * being promised an issue that has already gone out.
 */
export function startIssueFor(now = new Date()): { label: string; date: Date } {
  const d = new Date(now.getFullYear(), now.getMonth(), 1);
  if (now.getDate() > 25) d.setMonth(d.getMonth() + 1);
  return {
    label: d.toLocaleDateString("en-IN", { month: "long", year: "numeric" }),
    date: d,
  };
}

/** The last issue of a term, so the reader is told exactly what they get. */
export function endIssueFor(start: Date, issues: number): { label: string; date: Date } {
  const d = new Date(start.getFullYear(), start.getMonth() + issues - 1, 1);
  return {
    label: d.toLocaleDateString("en-IN", { month: "long", year: "numeric" }),
    date: d,
  };
}

/** The month an issue label such as "October 2026" names, or null if it names none. */
function issueMonth(label: string): Date | null {
  const d = new Date(`1 ${label}`);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * Whether a running subscription is owed this issue: it has issues left and
 * its term has begun. The first issue is worked back from the last, so a
 * school that paid in October and starts with November is not owed October.
 * Whether the issue was already posted is the caller's check.
 */
export function isOwed(
  s: { issuesSent: number; issuesTotal: number; endsAt: Date | null },
  issueLabel: string,
): boolean {
  if (s.issuesSent >= s.issuesTotal) return false;
  const month = issueMonth(issueLabel);
  if (!month || !s.endsAt) return true;
  const first = new Date(s.endsAt.getFullYear(), s.endsAt.getMonth() - s.issuesTotal + 1, 1);
  return first <= month;
}
