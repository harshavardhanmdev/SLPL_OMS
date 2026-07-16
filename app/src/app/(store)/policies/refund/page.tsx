import type { Metadata } from "next";

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

      <h2>Contact</h2>
      <p>{site.company}, {site.contact.address}. Phone: {site.contact.phone}. Email: {site.contact.email}.</p>
    </>
  );
}
