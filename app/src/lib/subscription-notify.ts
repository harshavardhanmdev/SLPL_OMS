import "server-only";

import { db } from "@/lib/db";
import { notifyOwner, renderEmail, sendEmail } from "@/lib/email";
import { formatINR } from "@/lib/money";

/**
 * Activates a paid subscription and sends the welcome email.
 *
 * Idempotent on status, so a webhook arriving twice cannot start the term
 * twice or send two welcome emails.
 */
export async function activateSubscriptions(orderId: string): Promise<void> {
  const pending = await db.subscription.findMany({
    where: { orderId, status: "PENDING" },
    select: { id: true },
  });

  for (const { id } of pending) {
    const sub = await db.subscription.update({
      where: { id },
      data: { status: "ACTIVE", startedAt: new Date() },
    });

    const endLabel = sub.endsAt
      ? sub.endsAt.toLocaleDateString("en-IN", { month: "long", year: "numeric" })
      : "";

    await sendEmail({
      to: sub.email,
      subject: `Your GenZ Times subscription is active - ${sub.code}`,
      template: "subscription-welcome",
      html: renderEmail(
        "Welcome to The GenZ Times",
        `<p style="margin:0 0 14px">Hi ${sub.subscriberName}, your subscription is confirmed.</p>
         <table role="presentation" width="100%" style="font-size:14px;border-collapse:collapse">
           <tr><td style="padding:4px 0;color:#5a6478">Subscription</td><td align="right" style="padding:4px 0"><b>${sub.code}</b></td></tr>
           <tr><td style="padding:4px 0;color:#5a6478">Term</td><td align="right" style="padding:4px 0">${sub.termMonths} months, ${sub.issuesTotal} issues</td></tr>
           <tr><td style="padding:4px 0;color:#5a6478">First issue</td><td align="right" style="padding:4px 0"><b>${sub.startIssue}</b></td></tr>
           ${endLabel ? `<tr><td style="padding:4px 0;color:#5a6478">Last issue</td><td align="right" style="padding:4px 0">${endLabel}</td></tr>` : ""}
           <tr><td style="padding:8px 0;border-top:1px solid #e3e8f2;font-weight:bold">Paid</td><td align="right" style="padding:8px 0;border-top:1px solid #e3e8f2;font-weight:bold">${formatINR(sub.amountPaid)}</td></tr>
         </table>
         <p style="margin:16px 0 6px"><b>Posting to</b></p>
         <p style="margin:0 0 14px;font-size:13px;color:#5a6478">
           ${sub.subscriberName}<br>${sub.addressLine1}${sub.addressLine2 ? `, ${sub.addressLine2}` : ""}<br>
           ${sub.city}, ${sub.state} - ${sub.pincode}<br>${sub.phone}
         </p>
         <p style="margin:10px 0 0;font-size:13px;color:#5a6478">
           Each issue is posted as it prints. If your address changes, reply to this email with
           your subscription number and we will update it before the next issue goes out.
         </p>`,
      ),
    });

    await notifyOwner(
      `New GenZ Times subscription: ${sub.subscriberName}, ${sub.termMonths} months`,
      renderEmail(
        "A subscription was paid for",
        `<p style="margin:0 0 10px"><b>${sub.code}</b>, ${sub.issuesTotal} issues from ${sub.startIssue}, ${formatINR(sub.amountPaid)}.</p>
         <p style="margin:0 0 10px">${sub.subscriberName} · ${sub.phone} · ${sub.email}</p>
         <p style="margin:0;font-size:13px;color:#5a6478">${sub.addressLine1}${sub.addressLine2 ? `, ${sub.addressLine2}` : ""}, ${sub.city}, ${sub.state} - ${sub.pincode}</p>
         <p style="margin:12px 0 0">Open the back office, Subscriptions, to see the posting list.</p>`,
      ),
      "owner-new-subscription",
    );
  }
}

/**
 * Daily: warn readers whose term ends within a month, once each.
 *
 * A lapsed subscriber who was never told is a subscriber lost by accident
 * rather than by choice.
 */
export async function remindExpiringSubscriptions(): Promise<number> {
  const soon = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  const due = await db.subscription.findMany({
    where: { status: "ACTIVE", renewalNoticeAt: null, endsAt: { lte: soon, gte: new Date() } },
  });

  for (const sub of due) {
    const endLabel = sub.endsAt
      ? sub.endsAt.toLocaleDateString("en-IN", { month: "long", year: "numeric" })
      : "soon";
    await sendEmail({
      to: sub.email,
      subject: `Your GenZ Times subscription ends with the ${endLabel} issue`,
      template: "subscription-renewal",
      html: renderEmail(
        "Time to renew",
        `<p style="margin:0 0 14px">Hi ${sub.subscriberName}, your subscription <b>${sub.code}</b> runs to the ${endLabel} issue.</p>
         <p style="margin:0 0 14px">Renew now and the issues keep arriving without a gap.</p>
         <p style="margin:0 0 14px">
           <a href="${process.env.APP_URL ?? "https://store.theslpl.in"}/subscribe" style="display:inline-block;background:#f5a623;color:#16213e;font-weight:bold;padding:11px 20px;border-radius:8px;text-decoration:none">Renew the subscription</a>
         </p>`,
      ),
    });
    await db.subscription.update({
      where: { id: sub.id },
      data: { renewalNoticeAt: new Date() },
    });
  }
  return due.length;
}
