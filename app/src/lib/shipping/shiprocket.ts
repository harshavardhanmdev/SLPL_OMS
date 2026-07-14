import "server-only";

/**
 * Shiprocket API client (https://apidocs.shiprocket.in).
 * Configured via SHIPROCKET_EMAIL / SHIPROCKET_PASSWORD (an "API user" created
 * in the Shiprocket dashboard — see docs/INTEGRATIONS.md). Every function
 * no-ops gracefully while unconfigured so the store works pre-signup.
 */

const BASE = "https://apiv2.shiprocket.in/v1/external";

export function isShiprocketConfigured(): boolean {
  return Boolean(process.env.SHIPROCKET_EMAIL && process.env.SHIPROCKET_PASSWORD);
}

let cachedToken: { token: string; expiresAt: number } | null = null;

async function token(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now()) return cachedToken.token;
  const res = await fetch(`${BASE}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: process.env.SHIPROCKET_EMAIL,
      password: process.env.SHIPROCKET_PASSWORD,
    }),
  });
  if (!res.ok) throw new Error(`Shiprocket auth failed: ${res.status}`);
  const data = (await res.json()) as { token: string };
  cachedToken = { token: data.token, expiresAt: Date.now() + 9 * 24 * 60 * 60 * 1000 };
  return data.token;
}

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${await token()}`,
      ...init?.headers,
    },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Shiprocket ${path} → ${res.status}: ${body.slice(0, 300)}`);
  }
  return (await res.json()) as T;
}

// ── Serviceability (delivery estimate + charge) ──────────────────────────────

type ServiceabilityResponse = {
  data?: {
    available_courier_companies?: {
      courier_name: string;
      rate: number; // rupees
      estimated_delivery_days?: string;
      etd?: string;
    }[];
  };
};

export type CourierQuote = {
  courier: string;
  ratePaise: number;
  etaDays: number;
};

export async function serviceability(params: {
  fromPincode: string;
  toPincode: string;
  weightGrams: number;
  cod: boolean;
}): Promise<CourierQuote[]> {
  const query = new URLSearchParams({
    pickup_postcode: params.fromPincode,
    delivery_postcode: params.toPincode,
    weight: String(Math.max(params.weightGrams, 100) / 1000),
    cod: params.cod ? "1" : "0",
  });
  const res = await api<ServiceabilityResponse>(`/courier/serviceability/?${query}`);
  const list = res.data?.available_courier_companies ?? [];
  return list
    .map((c) => ({
      courier: c.courier_name,
      ratePaise: Math.round(c.rate * 100),
      etaDays: Number(c.estimated_delivery_days ?? 5) || 5,
    }))
    .sort((a, b) => a.ratePaise - b.ratePaise);
}

// ── Order → shipment → AWB → pickup ─────────────────────────────────────────

type CreateOrderResponse = { order_id: number; shipment_id: number };
type AssignAwbResponse = {
  response?: { data?: { awb_code?: string; courier_name?: string } };
  awb_code?: string;
  courier_name?: string;
};

export type ShiprocketShipment = {
  shiprocketOrderId: string;
  shiprocketShipmentId: string;
  awb: string;
  courierName: string;
  trackingUrl: string;
};

export async function createShipmentForOrder(order: {
  orderNumber: string;
  createdAt: Date;
  paymentMethod: "RAZORPAY" | "COD";
  subtotal: number;
  total: number;
  customerEmail: string;
  shippingAddress: {
    fullName: string;
    phone: string;
    line1: string;
    line2: string | null;
    city: string;
    state: string;
    pincode: string;
  };
  items: { title: string; unitPrice: number; quantity: number; productId: string | null }[];
  weightGrams: number;
}): Promise<ShiprocketShipment> {
  const addr = order.shippingAddress;
  const [firstName, ...rest] = addr.fullName.split(" ");

  const created = await api<CreateOrderResponse>(`/orders/create/adhoc`, {
    method: "POST",
    body: JSON.stringify({
      order_id: order.orderNumber,
      order_date: order.createdAt.toISOString().slice(0, 19).replace("T", " "),
      pickup_location: process.env.SHIPROCKET_PICKUP_LOCATION ?? "Primary",
      billing_customer_name: firstName,
      billing_last_name: rest.join(" ") || ".",
      billing_address: addr.line1,
      billing_address_2: addr.line2 ?? "",
      billing_city: addr.city,
      billing_pincode: addr.pincode,
      billing_state: addr.state,
      billing_country: "India",
      billing_email: order.customerEmail,
      billing_phone: addr.phone,
      shipping_is_billing: true,
      order_items: order.items.map((i) => ({
        name: i.title.slice(0, 50),
        sku: i.productId ?? i.title.slice(0, 20).replace(/\s/g, "-"),
        units: i.quantity,
        selling_price: Math.round(i.unitPrice / 100),
      })),
      payment_method: order.paymentMethod === "COD" ? "COD" : "Prepaid",
      sub_total: Math.round(order.subtotal / 100),
      length: 30,
      breadth: 22,
      height: Math.max(3, Math.ceil(order.weightGrams / 400)),
      weight: Math.max(order.weightGrams, 100) / 1000,
    }),
  });

  const assigned = await api<AssignAwbResponse>(`/courier/assign/awb`, {
    method: "POST",
    body: JSON.stringify({ shipment_id: created.shipment_id }),
  });
  const awb = assigned.response?.data?.awb_code ?? assigned.awb_code;
  const courierName = assigned.response?.data?.courier_name ?? assigned.courier_name ?? "Courier";
  if (!awb) throw new Error("Shiprocket did not return an AWB — assign one from their dashboard.");

  await api(`/courier/generate/pickup`, {
    method: "POST",
    body: JSON.stringify({ shipment_id: [created.shipment_id] }),
  }).catch(() => {
    // pickup scheduling can fail outside working hours — AWB is still valid
  });

  return {
    shiprocketOrderId: String(created.order_id),
    shiprocketShipmentId: String(created.shipment_id),
    awb,
    courierName,
    trackingUrl: `https://shiprocket.co/tracking/${awb}`,
  };
}

// ── Tracking ─────────────────────────────────────────────────────────────────

type TrackResponse = {
  tracking_data?: {
    shipment_track?: { current_status?: string }[];
    shipment_track_activities?: { date: string; activity: string; location: string; "sr-status-label"?: string }[];
  };
};

export type TrackingInfo = {
  currentStatus: string;
  activities: { occurredAt: Date; description: string; location: string }[];
};

export async function trackByAwb(awb: string): Promise<TrackingInfo | null> {
  const res = await api<Record<string, TrackResponse> | TrackResponse>(`/courier/track/awb/${awb}`);
  const entry = ("tracking_data" in res ? res : Object.values(res)[0]) as TrackResponse | undefined;
  const data = entry?.tracking_data;
  if (!data) return null;
  return {
    currentStatus: data.shipment_track?.[0]?.current_status ?? "",
    activities: (data.shipment_track_activities ?? []).slice(0, 15).map((a) => ({
      occurredAt: new Date(a.date),
      description: a["sr-status-label"] ?? a.activity,
      location: a.location,
    })),
  };
}

/** Map Shiprocket status text to our ShipmentStatus enum. */
export function mapTrackingStatus(text: string): "IN_TRANSIT" | "OUT_FOR_DELIVERY" | "DELIVERED" | "RTO" | null {
  const s = text.toUpperCase();
  if (!s) return null;
  if (s.includes("DELIVERED") && !s.includes("UNDELIVERED")) return "DELIVERED";
  if (s.includes("OUT FOR DELIVERY")) return "OUT_FOR_DELIVERY";
  if (s.includes("RTO")) return "RTO";
  return "IN_TRANSIT";
}
