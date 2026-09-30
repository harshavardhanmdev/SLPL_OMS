import type { Metadata } from "next";
import Link from "next/link";

import { site } from "@/lib/site";

export const metadata: Metadata = { title: "Cancellation and Refund Policy" };

export default function RefundPolicyPage() {
  return (
    <>
      <h1>Cancellation and Refund Policy</h1>
      <p>Last updated: 16 July 2026. This policy applies to all orders on {site.name} (store.theslpl.in), operated by {site.company}.</p>

      <h2>Cancelling an order</h2>
      <ul>
        <li>You can request cancellation any time before the order is shipped by calling {site.contact.phone} or emailing {site.contact.email} with your order number.</li>
        <li>Orders cancelled before dispatch are refunded in full, including shipping charges.</li>
        <li>Once an order has shipped it can no longer be cancelled, but the replacement terms below still apply.</li>
      </ul>

      <h2>Damaged, defective or wrong items</h2>
      <ul>
        <li>If a book arrives damaged, has printing defects, or you received the wrong title, contact us within 48 hours of delivery with your order number and photos of the item and packaging.</li>
        <li>We will ship a free replacement, or issue a full refund for that item if a replacement is unavailable. Return shipping, where needed, is arranged and paid by us.</li>
      </ul>

      <h2>Refund timelines</h2>
      <ul>
        <li>Prepaid orders: refunds go back to the original payment method (card, UPI, netbanking) within 5 to 7 working days of approval, processed via Razorpay.</li>
        <li>Cash on Delivery orders: refunds are made by bank transfer to an account you provide, within 7 working days of approval.</li>
        <li>Interrupted or failed online payments are reversed automatically; if an amount was deducted without an order confirmation, it is auto-refunded, typically within 5 to 7 working days.</li>
      </ul>

      <h2>What is not returnable</h2>
      <p>Books that have been used, written in, or damaged after delivery are not eligible for return. Since our products are printed books, we do not accept change-of-mind returns once a parcel has been opened, except for the defect cases above.</p>

      <h2>Digital editions</h2>
      <p>A digital edition is delivered to your account the moment payment succeeds, so it cannot be returned once you have opened it. If you have not opened a single page, write to {site.contact.email} with your order number within 7 days and we will refund it in full. If an edition will not open, or pages are missing, tell us and we will fix it or refund you.</p>
      <p>A digital edition is licensed to one reader for their own use. Every page carries the buyer&apos;s name and licence number. Passing pages on, republishing them, or sharing the account is a breach of that licence, and we may withdraw access without a refund.</p>

      <h2>If a refund does not arrive</h2>
      <p>
        If a refund has not reached you within the timelines above, or an amount was debited without
        an order, raise it on our <Link href="/grievance">complaint form</Link>. You will get a
        ticket number, an acknowledgement within 48 hours and a named officer accountable for the
        outcome. See our <Link href="/policies/grievance">Grievance Redressal Policy</Link> for the
        full escalation route.
      </p>

      <h2>Contact</h2>
      <p>{site.company}, {site.contact.address}. Phone: {site.contact.phone}. Email: {site.contact.email}.</p>
    </>
  );
}
