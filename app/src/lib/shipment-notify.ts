import "server-only";

import { renderEmail, sendEmail } from "@/lib/email";

type OrderLite = {
  orderNumber: string;
  customerName: string;
  customerEmail: string;
};

type ShipmentLite = {
  courierName: string | null;
  awb: string | null;
  trackingUrl: string | null;
  etaDays: number | null;
};

export async function emailShipped(order: OrderLite, shipment: ShipmentLite): Promise<void> {
  const trackBlock = shipment.trackingUrl
    ? `<p style="margin:16px 0;text-align:center"><a href="${shipment.trackingUrl}" style="display:inline-block;background:#1e2a5a;color:#ffffff;text-decoration:none;border-radius:8px;padding:12px 24px;font-weight:bold">Track your package</a></p>`
    : "";
  await sendEmail({
    to: order.customerEmail,
    subject: `Your order ${order.orderNumber} is on its way 📦`,
    template: "order-shipped",
    html: renderEmail(
      "Your books have shipped!",
      `<p style="margin:0 0 10px">Hi ${order.customerName}, your order <b>${order.orderNumber}</b> has been handed to the courier.</p>
       <p style="margin:0 0 4px"><b>Courier:</b> ${shipment.courierName ?? "Assigned"}</p>
       ${shipment.awb ? `<p style="margin:0 0 4px"><b>Tracking number (AWB):</b> ${shipment.awb}</p>` : ""}
       ${shipment.etaDays ? `<p style="margin:0 0 4px"><b>Expected delivery:</b> about ${shipment.etaDays} days</p>` : ""}
       ${trackBlock}
       <p style="margin:10px 0 0;font-size:13px;color:#5a6478">You will get another email when it is out for delivery.</p>`,
    ),
  });
}

export async function emailOutForDelivery(order: OrderLite, shipment: ShipmentLite): Promise<void> {
  await sendEmail({
    to: order.customerEmail,
    subject: `Out for delivery — order ${order.orderNumber} 🚚`,
    template: "order-out-for-delivery",
    html: renderEmail(
      "Arriving today!",
      `<p style="margin:0 0 10px">Hi ${order.customerName}, your order <b>${order.orderNumber}</b> is out for delivery and should reach you today.</p>
       ${shipment.trackingUrl ? `<p style="margin:12px 0;text-align:center"><a href="${shipment.trackingUrl}" style="display:inline-block;background:#1e2a5a;color:#ffffff;text-decoration:none;border-radius:8px;padding:12px 24px;font-weight:bold">Live tracking</a></p>` : ""}
       <p style="margin:10px 0 0;font-size:13px;color:#5a6478">Please keep your phone reachable for the delivery partner.</p>`,
    ),
  });
}

export async function emailDelivered(order: OrderLite): Promise<void> {
  await sendEmail({
    to: order.customerEmail,
    subject: `Delivered — order ${order.orderNumber} ✅`,
    template: "order-delivered",
    html: renderEmail(
      "Your order has been delivered",
      `<p style="margin:0 0 10px">Hi ${order.customerName}, order <b>${order.orderNumber}</b> was delivered. Happy learning!</p>
       <p style="margin:10px 0 0;font-size:13px;color:#5a6478">Received a damaged copy? Reply to this email or call +91 79891 91962 within 48 hours and we will replace it.</p>`,
    ),
  });
}
