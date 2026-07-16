import type { Metadata } from "next";

import { site } from "@/lib/site";

export const metadata: Metadata = { title: "Privacy Policy" };

export default function PrivacyPage() {
  return (
    <>
      <h1>Privacy Policy</h1>
      <p>Last updated: 16 July 2026. This policy explains how {site.company} ("we") handles your information when you use {site.name} (store.theslpl.in).</p>

      <h2>What we collect</h2>
      <ul>
        <li>Account details: name, email address, mobile number and an encrypted password (or your Google account email if you sign in with Google).</li>
        <li>Delivery details: addresses, pincode and, if you choose to pin it, the map location of your doorstep.</li>
        <li>Order details: the items you buy, payment method and order history.</li>
        <li>Basic technical data needed to run the site securely (such as IP address for rate limiting).</li>
      </ul>

      <h2>How we use it</h2>
      <ul>
        <li>To process orders, arrange delivery and send order updates by email.</li>
        <li>To provide your account features: saved addresses, order history, notifications.</li>
        <li>To respond to support requests.</li>
        <li>With your consent, to send occasional offers (you can switch these off in Account, then Settings).</li>
      </ul>

      <h2>Who we share it with</h2>
      <ul>
        <li>Payment processing: Razorpay receives the information needed to process your payment. We never see or store your card, UPI or banking credentials.</li>
        <li>Delivery: our courier partners receive your name, address and phone number to deliver your parcel and send tracking updates.</li>
        <li>We do not sell or rent your personal data to anyone.</li>
      </ul>

      <h2>Cookies and storage</h2>
      <p>We use essential cookies to keep you signed in, and your browser's local storage for your cart and preferred pincode. We do not use third-party advertising trackers.</p>

      <h2>Security and retention</h2>
      <p>Passwords are stored only as strong one-way hashes. Data is transmitted over HTTPS and stored on secured servers with daily backups. Order records are retained as required for accounting and legal purposes.</p>

      <h2>Your rights</h2>
      <p>You can edit your profile and addresses in your account at any time. To request a copy or deletion of your data, email {site.contact.email} from your registered address; we respond within 7 working days.</p>

      <h2>Contact</h2>
      <p>{site.company}, {site.contact.address}. Phone: {site.contact.phone}. Email: {site.contact.email}.</p>
    </>
  );
}
