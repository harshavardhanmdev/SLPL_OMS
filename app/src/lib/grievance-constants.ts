/**
 * Pure grievance vocabulary shared by server code and client components.
 * Deliberately free of "server-only" and of any database import so the
 * complaint form and status badges can use it in the browser.
 *
 * The two SLA clocks come from the Consumer Protection (E-Commerce) Rules:
 * acknowledge within 48 hours, resolve within one month.
 */

export const ACK_SLA_HOURS = 48;
export const RESOLUTION_SLA_DAYS = 30;

export const GRIEVANCE_CATEGORIES = [
  { value: "PAYMENT_DEBITED_NO_ORDER", label: "Money debited but no order confirmed" },
  { value: "REFUND_NOT_RECEIVED", label: "Refund not received" },
  { value: "DOUBLE_CHARGED", label: "Charged twice for one order" },
  { value: "ORDER_NOT_DELIVERED", label: "Order not delivered" },
  { value: "DAMAGED_OR_WRONG_ITEM", label: "Damaged or wrong item received" },
  { value: "CANCELLATION_ISSUE", label: "Problem cancelling an order" },
  { value: "DATA_PRIVACY", label: "Data or privacy concern" },
  { value: "OTHER", label: "Something else" },
] as const;

export type GrievanceCategoryValue = (typeof GRIEVANCE_CATEGORIES)[number]["value"];

/** Money is involved in these, so they jump the queue. */
export const PAYMENT_CATEGORIES: GrievanceCategoryValue[] = [
  "PAYMENT_DEBITED_NO_ORDER",
  "REFUND_NOT_RECEIVED",
  "DOUBLE_CHARGED",
];

export function isPaymentCategory(category: string): boolean {
  return PAYMENT_CATEGORIES.includes(category as GrievanceCategoryValue);
}

export function priorityFor(category: string): "NORMAL" | "HIGH" {
  return isPaymentCategory(category) ? "HIGH" : "NORMAL";
}

export function categoryLabel(category: string): string {
  return GRIEVANCE_CATEGORIES.find((c) => c.value === category)?.label ?? category;
}

/** Same tone vocabulary as the customer order page, so badges look consistent. */
export const grievanceStatusMeta: Record<string, { label: string; tone: "ok" | "warn" | "bad" | "info" }> = {
  OPEN: { label: "Open", tone: "warn" },
  ACKNOWLEDGED: { label: "Acknowledged", tone: "info" },
  IN_PROGRESS: { label: "Being looked into", tone: "info" },
  AWAITING_CUSTOMER: { label: "Waiting for your reply", tone: "warn" },
  RESOLVED: { label: "Resolved", tone: "ok" },
  CLOSED: { label: "Closed", tone: "info" },
  ESCALATED: { label: "Escalated", tone: "bad" },
};

export function toneClass(tone: "ok" | "warn" | "bad" | "info"): string {
  return tone === "ok"
    ? "bg-green-600 text-white"
    : tone === "warn"
      ? "bg-saffron text-navy"
      : tone === "bad"
        ? "bg-destructive text-white"
        : "bg-primary text-primary-foreground";
}

const OPEN_STATUSES = ["OPEN", "ACKNOWLEDGED", "IN_PROGRESS", "AWAITING_CUSTOMER", "ESCALATED"];

export function isStillOpen(status: string): boolean {
  return OPEN_STATUSES.includes(status);
}

export function isAckOverdue(g: { status: string; acknowledgedAt: Date | null; ackDueAt: Date }): boolean {
  return !g.acknowledgedAt && g.status === "OPEN" && g.ackDueAt.getTime() < Date.now();
}

export function isResolutionOverdue(g: { status: string; dueAt: Date }): boolean {
  return isStillOpen(g.status) && g.dueAt.getTime() < Date.now();
}
