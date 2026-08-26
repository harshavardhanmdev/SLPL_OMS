import "server-only";

import { db } from "@/lib/db";
import { renderEmail, notifyOwner } from "@/lib/email";
import { categoryLabel } from "@/lib/grievance-constants";

/**
 * Daily safety net: emails the owner about complaints that have blown either
 * statutory deadline. Missing the 48 hour acknowledgement or the 30 day
 * resolution is exactly what the e-commerce rules penalise, so this is cheap
 * insurance against a quiet inbox.
 */
export async function reportOverdueGrievances(): Promise<number> {
  const now = new Date();
  const openStatuses = ["OPEN", "ACKNOWLEDGED", "IN_PROGRESS", "AWAITING_CUSTOMER", "ESCALATED"] as const;

  const [ackOverdue, resolutionOverdue] = await Promise.all([
    db.grievance.findMany({
      where: { status: "OPEN", acknowledgedAt: null, ackDueAt: { lt: now } },
      orderBy: { ackDueAt: "asc" },
    }),
    db.grievance.findMany({
      where: { status: { in: [...openStatuses] }, dueAt: { lt: now } },
      orderBy: { dueAt: "asc" },
    }),
  ]);

  if (ackOverdue.length === 0 && resolutionOverdue.length === 0) return 0;

  const line = (g: (typeof ackOverdue)[number], deadline: Date) =>
    `<li><b>${g.ticketNumber}</b> - ${categoryLabel(g.category)} from ${g.contactName} · due ${deadline.toLocaleString(
      "en-IN",
      { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" },
    )}</li>`;

  const sections = [
    ackOverdue.length > 0
      ? `<p style="margin:0 0 6px"><b>Past the 48 hour acknowledgement deadline (${ackOverdue.length})</b></p>
         <ul style="margin:0 0 14px;padding-left:18px">${ackOverdue.map((g) => line(g, g.ackDueAt)).join("")}</ul>`
      : "",
    resolutionOverdue.length > 0
      ? `<p style="margin:0 0 6px"><b>Past the 30 day resolution deadline (${resolutionOverdue.length})</b></p>
         <ul style="margin:0 0 14px;padding-left:18px">${resolutionOverdue.map((g) => line(g, g.dueAt)).join("")}</ul>`
      : "",
  ].join("");

  await notifyOwner(
    `Action needed: ${ackOverdue.length + resolutionOverdue.length} overdue grievance(s)`,
    renderEmail(
      "Grievances need your attention",
      `${sections}<p style="margin:10px 0 0">Open the admin panel, Grievances, to clear these. Missing these deadlines is what the e-commerce rules penalise.</p>`,
    ),
    "grievance-sla-digest",
  );

  return ackOverdue.length + resolutionOverdue.length;
}
