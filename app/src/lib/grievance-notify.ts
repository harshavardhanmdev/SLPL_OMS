import "server-only";

import { renderEmail, sendEmail, notifyOwner } from "@/lib/email";
import { notifyUser } from "@/lib/notify";
import { categoryLabel, trackingUrl } from "@/lib/grievances";
import { site } from "@/lib/site";

/**
 * Grievance emails. These are statutory acknowledgements and status updates,
 * so like order confirmations they always send and never check email prefs.
 */

type GrievanceLite = {
  ticketNumber: string;
  accessToken: string;
  category: string;
  subject: string;
  contactName: string;
  contactEmail: string;
  userId: string | null;
  ackDueAt: Date;
  dueAt: Date;
};

const officerBlock = (officerName: string, officerEmail: string) =>
  `<p style="margin:14px 0 0;font-size:13px;color:#5a6478">Grievance Officer: ${officerName} · ${officerEmail} · ${site.contact.phone}<br>${site.company}, ${site.contact.address}</p>`;

const dateIN = (d: Date) =>
  d.toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" });

export async function emailGrievanceReceived(
  g: GrievanceLite,
  officer: { name: string; email: string },
): Promise<void> {
  const link = trackingUrl(g.accessToken);

  await sendEmail({
    to: g.contactEmail,
    subject: `We have your complaint - ticket ${g.ticketNumber}`,
    template: "grievance-received",
    html: renderEmail(
      "Your complaint has been registered",
      `<p style="margin:0 0 10px">Hi ${g.contactName}, thank you for writing to us. Your complaint is registered and our team is on it.</p>
       <p style="margin:0 0 4px"><b>Ticket number:</b> ${g.ticketNumber}</p>
       <p style="margin:0 0 4px"><b>Issue:</b> ${categoryLabel(g.category)}</p>
       <p style="margin:0 0 10px"><b>Subject:</b> ${g.subject}</p>
       <p style="margin:0 0 10px">We will acknowledge your complaint by <b>${dateIN(g.ackDueAt)}</b> and work to resolve it by <b>${dateIN(g.dueAt)}</b>.</p>
       <p style="margin:16px 0;text-align:center"><a href="${link}" style="display:inline-block;background:#1e2a5a;color:#ffffff;text-decoration:none;border-radius:8px;padding:12px 24px;font-weight:bold">Track this complaint</a></p>
       <p style="margin:10px 0 0;font-size:13px;color:#5a6478">Save this email: the link above is how you check progress and reply to us.</p>
       ${officerBlock(officer.name, officer.email)}`,
    ),
  });

  if (g.userId) {
    await notifyUser(
      g.userId,
      "Complaint registered",
      `Ticket ${g.ticketNumber} is with our team. We will update you here.`,
      `/account/grievances`,
    );
  }

  await notifyOwner(
    `Grievance ${g.ticketNumber} - ${categoryLabel(g.category)}`,
    renderEmail(
      "New grievance filed",
      `<p style="margin:0 0 6px"><b>Ticket:</b> ${g.ticketNumber}</p>
       <p style="margin:0 0 6px"><b>Category:</b> ${categoryLabel(g.category)}</p>
       <p style="margin:0 0 6px"><b>Subject:</b> ${g.subject}</p>
       <p style="margin:0 0 6px"><b>From:</b> ${g.contactName} (${g.contactEmail})</p>
       <p style="margin:14px 0 0"><b>Acknowledge by ${dateIN(g.ackDueAt)}</b> to stay within the 48 hour rule. Open the admin panel to respond.</p>`,
    ),
    "grievance-owner-new",
  );
}

export async function emailGrievanceUpdate(
  g: GrievanceLite & { status: string },
  headline: string,
  body: string,
  officer: { name: string; email: string },
): Promise<void> {
  await sendEmail({
    to: g.contactEmail,
    subject: `Update on your complaint ${g.ticketNumber}`,
    template: "grievance-update",
    html: renderEmail(
      headline,
      `<p style="margin:0 0 10px">Hi ${g.contactName}, here is an update on ticket <b>${g.ticketNumber}</b>.</p>
       <p style="margin:0 0 10px">${body}</p>
       <p style="margin:16px 0;text-align:center"><a href="${trackingUrl(g.accessToken)}" style="display:inline-block;background:#1e2a5a;color:#ffffff;text-decoration:none;border-radius:8px;padding:12px 24px;font-weight:bold">View your complaint</a></p>
       ${officerBlock(officer.name, officer.email)}`,
    ),
  });

  if (g.userId) {
    await notifyUser(g.userId, headline, `Ticket ${g.ticketNumber}: ${body}`, `/account/grievances`);
  }
}

/** Customer replied on the tracking page - the ball is back with us. */
export async function notifyOwnerOfReply(ticketNumber: string, name: string, message: string): Promise<void> {
  await notifyOwner(
    `Reply on grievance ${ticketNumber}`,
    renderEmail(
      "Customer replied",
      `<p style="margin:0 0 6px"><b>Ticket:</b> ${ticketNumber}</p>
       <p style="margin:0 0 6px"><b>From:</b> ${name}</p>
       <p style="margin:12px 0 0;white-space:pre-line">${message.replace(/</g, "&lt;")}</p>`,
    ),
    "grievance-owner-reply",
  );
}
