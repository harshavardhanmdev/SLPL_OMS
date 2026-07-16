import type { Metadata } from "next";

import { site } from "@/lib/site";

export const metadata: Metadata = { title: "Terms and Conditions" };

export default function TermsPage() {
  return (
    <>
      <h1>Terms and Conditions</h1>
      <p>Last updated: 16 July 2026. By using {site.name} (store.theslpl.in) you agree to these terms. The store is operated by {site.company} ("SLPL", "we", "us"), registered at {site.contact.address}.</p>

      <h2>Products and pricing</h2>
      <ul>
        <li>We sell printed educational books, novels, poem collections and book bundles published or distributed by SLPL.</li>
        <li>All prices are listed in Indian Rupees (INR). Printed books are currently exempt from GST; where any tax applies it is included in the displayed price.</li>
        <li>Prices, discounts and availability may change without notice. The price shown at checkout at the time of payment is final for that order.</li>
      </ul>

      <h2>Orders and payment</h2>
      <ul>
        <li>An order is confirmed only after successful payment (or COD confirmation via the emailed one-time code).</li>
        <li>Online payments are processed securely by Razorpay. We never store your card, UPI or banking credentials.</li>
        <li>Cash on Delivery is available for orders below the limit shown at checkout.</li>
        <li>We may cancel orders due to stock unavailability, pricing errors or suspected fraud; any amount paid is refunded in full.</li>
      </ul>

      <h2>Delivery</h2>
      <p>Delivery is handled per our Shipping Policy. Ownership and risk pass to you on delivery at the address you provided. Please provide an accurate address and reachable phone number.</p>

      <h2>Returns and refunds</h2>
      <p>Returns, replacements and refunds are governed by our Cancellation and Refund Policy.</p>

      <h2>Accounts</h2>
      <p>You are responsible for keeping your account credentials confidential. You must provide accurate information when registering. We may suspend accounts used fraudulently.</p>

      <h2>Intellectual property</h2>
      <p>All book content, cover artwork, logos and website content are the property of {site.company} or its licensors and may not be reproduced without written permission.</p>

      <h2>Limitation of liability</h2>
      <p>Our liability for any claim arising from an order is limited to the amount paid for that order. We are not liable for indirect or consequential losses.</p>

      <h2>Governing law</h2>
      <p>These terms are governed by the laws of India. Courts at Hyderabad, Telangana have exclusive jurisdiction.</p>

      <h2>Contact</h2>
      <p>{site.company}, {site.contact.address}. Phone: {site.contact.phone}. Email: {site.contact.email}.</p>
    </>
  );
}
