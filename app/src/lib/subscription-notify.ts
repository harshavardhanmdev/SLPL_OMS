import "server-only";

import { randomBytes } from "node:crypto";

import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { notifyOwner, renderEmail, sendEmail } from "@/lib/email";
import { formatINR } from "@/lib/money";
import { endIssueFor, isOwed, issueLabelFor, planById } from "@/lib/subscription-plans";

type Tx = Prisma.TransactionClient;

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
  // A school's renewal goes through its salesperson and a fresh invoice, not /subscribe
  const due = await db.subscription.findMany({
    where: {
      status: "ACTIVE",
      invoiceId: null,
      renewalNoticeAt: null,
      endsAt: { lte: soon, gte: new Date() },
    },
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

/** SLPL-S-YYMM-XXXXX, the same shape as a subscription bought at /subscribe. */
async function subscriptionCode(tx: Tx): Promise<string> {
  const now = new Date();
  const stamp = `${String(now.getFullYear()).slice(2)}${String(now.getMonth() + 1).padStart(2, "0")}`;
  for (let i = 0; i < 5; i++) {
    const candidate = `SLPL-S-${stamp}-${randomBytes(3).toString("hex").toUpperCase().slice(0, 5)}`;
    if (!(await tx.subscription.findUnique({ where: { code: candidate } }))) return candidate;
  }
  throw new Error("Could not allocate a subscription number - please retry.");
}

/**
 * A school that bought The GenZ Times on an invoice joins the posting list
 * once the bill is paid in full. One subscription per line, with the line's
 * quantity as the copies of each issue, posted from the month after payment.
 *
 * Runs inside the payment's transaction, so money and subscription land
 * together, and does nothing if the invoice already has its subscriptions.
 */
export async function startInvoiceSubscriptions(
  tx: Tx,
  invoiceId: string,
  paidOn: Date,
): Promise<number> {
  if (await tx.subscription.findFirst({ where: { invoiceId }, select: { id: true } })) return 0;
  const invoice = await tx.invoice.findUnique({
    where: { id: invoiceId },
    include: { items: { where: { productId: { startsWith: "magazine:" } } } },
  });
  if (!invoice) return 0;

  // Delivery starts the month after the money arrives
  const start = new Date(paidOn.getFullYear(), paidOn.getMonth() + 1, 1);
  let made = 0;
  for (const item of invoice.items) {
    const plan = planById(item.productId!.slice("magazine:".length));
    if (!plan) continue;
    await tx.subscription.create({
      data: {
        code: await subscriptionCode(tx),
        invoiceId: invoice.id,
        copies: item.quantity,
        subscriberName: invoice.customerName,
        email: invoice.email ?? "",
        phone: invoice.phone ?? "",
        addressLine1: invoice.addressLine ?? "",
        addressLine2: invoice.contactPerson ? `Attn: ${invoice.contactPerson}` : null,
        city: invoice.city ?? "",
        state: invoice.state ?? "",
        pincode: invoice.pincode ?? "",
        termMonths: plan.months,
        issuesTotal: plan.issues,
        amountPaid: item.lineTotal,
        status: "ACTIVE",
        startIssue: issueLabelFor(start),
        startedAt: paidOn,
        endsAt: endIssueFor(start, plan.issues).date,
        notes: `From invoice ${invoice.number}`,
      },
    });
    made++;
  }
  return made;
}

/**
 * The payment behind an invoice was voided, so its subscriptions come off the
 * posting list. One that has had an issue posted stays, for the owner to
 * settle by hand, since copies already went out.
 */
export async function stopInvoiceSubscriptions(tx: Tx, invoiceIds: string[]): Promise<number> {
  if (invoiceIds.length === 0) return 0;
  const gone = await tx.subscription.deleteMany({
    where: { invoiceId: { in: invoiceIds }, issuesSent: 0 },
  });
  return gone.count;
}

const esc = (text: string) =>
  text.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

/**
 * On the 1st and the 15th: tell the owner who is still owed this month's
 * issue and how many copies that is. Silent once the posting run is recorded.
 */
export async function remindPosting(now = new Date()): Promise<number> {
  const issue = issueLabelFor(now);
  const due = (
    await db.subscription.findMany({
      where: { status: "ACTIVE", dispatches: { none: { issueLabel: issue } } },
      orderBy: [{ city: "asc" }, { subscriberName: "asc" }],
    })
  ).filter((s) => isOwed(s, issue));
  if (due.length === 0) return 0;

  const copies = due.reduce((n, s) => n + s.copies, 0);
  const rows = due
    .map(
      (s) =>
        `<tr><td style="padding:4px 0;border-top:1px solid #e3e8f2">${esc(s.subscriberName)}${s.invoiceId ? " (school)" : ""}</td>` +
        `<td style="padding:4px 8px;border-top:1px solid #e3e8f2;color:#5a6478">${esc(s.city)}</td>` +
        `<td align="right" style="padding:4px 0;border-top:1px solid #e3e8f2">${s.copies}</td></tr>`,
    )
    .join("");
  const app = process.env.APP_URL ?? "https://store.theslpl.in";

  await notifyOwner(
    `Post The GenZ Times ${issue}: ${copies} ${copies === 1 ? "copy" : "copies"} to ${due.length} ${due.length === 1 ? "subscriber" : "subscribers"}`,
    renderEmail(
      `The ${issue} issue is due`,
      `<p style="margin:0 0 14px">${due.length} ${due.length === 1 ? "subscriber is" : "subscribers are"} still owed the ${issue} issue, ${copies} ${copies === 1 ? "copy" : "copies"} in all.</p>
       <table role="presentation" width="100%" style="font-size:13px;border-collapse:collapse">
         <tr><th align="left" style="padding:4px 0">Subscriber</th><th align="left" style="padding:4px 8px">City</th><th align="right" style="padding:4px 0">Copies</th></tr>
         ${rows}
       </table>
       <p style="margin:16px 0 14px">
         <a href="${app}/erp/subscriptions/posting" style="display:inline-block;background:#f5a623;color:#16213e;font-weight:bold;padding:11px 20px;border-radius:8px;text-decoration:none">Print the address labels</a>
       </p>
       <p style="margin:0;font-size:13px;color:#5a6478">Once they are in the post, record the run under Subscriptions so this reminder stops.</p>`,
    ),
    "subscription-posting-reminder",
  );
  return due.length;
}
