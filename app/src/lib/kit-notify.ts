import "server-only";

import { db } from "@/lib/db";
import { notifyOwner, renderEmail, sendEmail } from "@/lib/email";
import { receiptUrl } from "@/lib/kits";
import { formatINR } from "@/lib/money";

/**
 * The receipt email links to the receipt page rather than embedding the QR.
 * Mail clients strip inline SVG and block data URIs, so a link that always
 * renders is worth more than an image that sometimes does. Same pattern as the
 * grievance tracking link.
 */
export async function emailKitReceipt(purchaseId: string): Promise<void> {
  const purchase = await db.kitPurchase.findUnique({
    where: { id: purchaseId },
    include: {
      order: { select: { customerEmail: true, customerName: true, orderNumber: true } },
      schoolKit: { select: { academicYear: true, collectionNote: true } },
    },
  });
  if (!purchase) return;

  const url = receiptUrl(purchase.accessToken);
  const body = `
    <p style="margin:0 0 14px">Hi ${purchase.order.customerName}, the school kit for <b>${purchase.studentName}</b> is paid for.</p>
    <table role="presentation" width="100%" style="font-size:14px;border-collapse:collapse">
      <tr><td style="padding:4px 0;color:#5a6478">Student</td><td align="right" style="padding:4px 0"><b>${purchase.studentName}</b></td></tr>
      <tr><td style="padding:4px 0;color:#5a6478">Class</td><td align="right" style="padding:4px 0">${purchase.classLabel} ${purchase.section}</td></tr>
      <tr><td style="padding:4px 0;color:#5a6478">School</td><td align="right" style="padding:4px 0">${purchase.schoolName}</td></tr>
      <tr><td style="padding:4px 0;color:#5a6478">Kit</td><td align="right" style="padding:4px 0">${purchase.kitTitle}</td></tr>
      <tr><td style="padding:4px 0;color:#5a6478">Academic year</td><td align="right" style="padding:4px 0">${purchase.schoolKit.academicYear}</td></tr>
      <tr><td style="padding:8px 0;border-top:1px solid #e3e8f2;font-weight:bold">Amount paid</td><td align="right" style="padding:8px 0;border-top:1px solid #e3e8f2;font-weight:bold">${formatINR(purchase.amountPaid)}</td></tr>
      <tr><td style="padding:4px 0;color:#5a6478">Receipt number</td><td align="right" style="padding:4px 0"><b>${purchase.receiptNumber}</b></td></tr>
    </table>
    <p style="margin:18px 0 8px"><b>Show this receipt at the school to collect the kit.</b></p>
    <p style="margin:0 0 14px">
      <a href="${url}" style="display:inline-block;background:#f5a623;color:#16213e;font-weight:bold;padding:11px 20px;border-radius:8px;text-decoration:none">Open the receipt and QR code</a>
    </p>
    ${purchase.schoolKit.collectionNote ? `<p style="margin:0 0 10px;font-size:13px;color:#5a6478">${purchase.schoolKit.collectionNote}</p>` : ""}
    <p style="margin:10px 0 0;font-size:12px;color:#5a6478">Keep this link private. Anyone holding it can collect the kit.</p>`;

  await sendEmail({
    to: purchase.order.customerEmail,
    subject: `Kit receipt ${purchase.receiptNumber} for ${purchase.studentName} - SLPL Store`,
    template: "kit-receipt",
    html: renderEmail("Your school kit is paid for", body),
  });

  await notifyOwner(
    `Kit sold: ${purchase.studentName}, ${purchase.classLabel} at ${purchase.schoolName}`,
    renderEmail(
      "A school kit was paid for",
      `<p style="margin:0 0 10px">Receipt <b>${purchase.receiptNumber}</b> against order ${purchase.order.orderNumber}, ${formatINR(purchase.amountPaid)}.</p>
       <p style="margin:0">Open the admin panel, School kits, to see the collection sheet for ${purchase.schoolName}.</p>`,
    ),
    "owner-kit-sold",
  );
}
