import type { Metadata } from "next";

import { site } from "@/lib/site";

export const metadata: Metadata = { title: "Shipping Policy" };

export default function ShippingPolicyPage() {
  return (
    <>
      <h1>Shipping Policy</h1>
      <p>Last updated: 16 July 2026. This policy applies to all orders placed on {site.name} (store.theslpl.in), operated by {site.company}.</p>

      <h2>Where we deliver</h2>
      <p>We currently ship across India only. We do not ship internationally.</p>

      <h2>Dispatch and delivery time</h2>
      <ul>
        <li>Orders are packed and dispatched from Hyderabad within 2 to 3 business days of payment confirmation (or COD confirmation).</li>
        <li>Delivery typically takes 2 to 4 days within Telangana and Andhra Pradesh, and 4 to 9 days for the rest of India, depending on the destination pincode.</li>
        <li>An estimated delivery window for your pincode is shown on every product page and at checkout before you pay.</li>
      </ul>

      <h2>Shipping charges</h2>
      <p>Shipping charges are calculated by destination and weight and are always shown at checkout before payment. There are no hidden charges after you place the order.</p>

      <h2>Couriers and tracking</h2>
      <ul>
        <li>We ship through reputed courier partners (including BlueDart, Delhivery, DTDC and India Post, assigned per shipment).</li>
        <li>As soon as your order ships you receive an email with the courier name, tracking number (AWB) and a live tracking link.</li>
        <li>You also get updates when the parcel is out for delivery and when it is delivered, and you can track any order from Your Account, then Returns and Orders.</li>
      </ul>

      <h2>Delays</h2>
      <p>Courier delays due to weather, strikes or regional disruptions are occasionally outside our control. If your order has not arrived within the estimated window, write to {site.contact.email} or call {site.contact.phone} and we will chase it with the courier.</p>

      <h2>Contact</h2>
      <p>{site.company}, {site.contact.address}. Phone: {site.contact.phone}. Email: {site.contact.email}.</p>
    </>
  );
}
