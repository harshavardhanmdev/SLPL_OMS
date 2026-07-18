import "server-only";

import { db } from "@/lib/db";
import { emailDelivered, emailOutForDelivery } from "@/lib/shipment-notify";
import { isShiprocketConfigured, mapTrackingStatus, trackByAwb } from "@/lib/shipping/shiprocket";

type ActiveShipment = Awaited<ReturnType<typeof findActiveShipments>>[number];

function findActiveShipments(provider: string) {
  return db.shipment.findMany({
    where: {
      provider,
      awb: { not: null },
      status: { in: ["PENDING", "CREATED", "PICKUP_SCHEDULED", "IN_TRANSIT", "OUT_FOR_DELIVERY"] },
    },
    include: { order: true, events: { orderBy: { occurredAt: "desc" }, take: 30 } },
  });
}

/** Shared transition handling: persist new status, advance the order, notify the customer. */
async function applyStatus(
  shipment: ActiveShipment,
  mapped: ActiveShipment["status"],
  noteSource: string,
): Promise<void> {
  if (mapped === shipment.status) return;
  await db.shipment.update({ where: { id: shipment.id }, data: { status: mapped } });

  if (mapped === "OUT_FOR_DELIVERY" && shipment.order.status === "SHIPPED") {
    await db.$transaction([
      db.order.update({ where: { id: shipment.orderId }, data: { status: "OUT_FOR_DELIVERY" } }),
      db.orderEvent.create({
        data: { orderId: shipment.orderId, status: "OUT_FOR_DELIVERY", note: noteSource },
      }),
    ]);
    await emailOutForDelivery(shipment.order, shipment);
  } else if (mapped === "DELIVERED" && ["SHIPPED", "OUT_FOR_DELIVERY"].includes(shipment.order.status)) {
    await db.$transaction([
      db.order.update({ where: { id: shipment.orderId }, data: { status: "DELIVERED" } }),
      db.orderEvent.create({
        data: { orderId: shipment.orderId, status: "DELIVERED", note: noteSource },
      }),
    ]);
    await emailDelivered(shipment.order);
  } else if (mapped === "RTO") {
    await db.orderEvent.create({
      data: {
        orderId: shipment.orderId,
        status: "RTO",
        note: "Shipment returning to origin - contact the courier",
      },
    });
  }
}

/**
 * Worker job (every 3 h): poll courier APIs for every active AWB, append new
 * tracking events, and advance order status (+ emails) on transitions.
 * Covers Shiprocket shipments and, when TRACKCOURIER_API_KEY is set,
 * self-shipped manual (DTDC) consignments via trackcourier.io.
 */
export async function syncShipmentTracking(): Promise<void> {
  await syncShiprocketShipments();
  await syncManualShipments();
}

async function syncShiprocketShipments(): Promise<void> {
  if (!isShiprocketConfigured()) return;

  const active = await findActiveShipments("shiprocket");
  for (const shipment of active) {
    try {
      const info = await trackByAwb(shipment.awb!);
      if (!info) continue;

      // Append events we haven't stored yet (keyed by time+description)
      const seen = new Set(shipment.events.map((e) => `${e.occurredAt.getTime()}|${e.description}`));
      for (const a of info.activities) {
        const key = `${a.occurredAt.getTime()}|${a.description}`;
        if (seen.has(key)) continue;
        await db.shipmentEvent.create({
          data: {
            shipmentId: shipment.id,
            status: "TRACKING",
            description: a.description,
            location: a.location,
            occurredAt: a.occurredAt,
          },
        });
      }

      const mapped = mapTrackingStatus(info.currentStatus);
      if (!mapped) continue;
      await applyStatus(shipment, mapped, "Courier update");
    } catch (err) {
      console.error("[tracking-sync] AWB", shipment.awb, err);
    }
  }
}

// ── Manual (self-shipped DTDC) tracking via trackcourier.io ──────────────────
// Free tier: 100 requests/month. Dormant until TRACKCOURIER_API_KEY is set.

type TrackCourierCheckpoint = {
  status?: string;
  location?: string;
  checkpoint_time?: string;
};

function mapManualStatus(text: string): "IN_TRANSIT" | "OUT_FOR_DELIVERY" | "DELIVERED" | "RTO" | null {
  const t = text.toLowerCase();
  if (t.includes("delivered")) return "DELIVERED";
  if (t.includes("out for delivery")) return "OUT_FOR_DELIVERY";
  if (t.includes("rto") || t.includes("return")) return "RTO";
  if (t.includes("transit") || t.includes("forwarded") || t.includes("received")) return "IN_TRANSIT";
  return null;
}

async function syncManualShipments(): Promise<void> {
  const apiKey = process.env.TRACKCOURIER_API_KEY;
  if (!apiKey) return;
  const courier = process.env.TRACKCOURIER_COURIER ?? "dtdc";

  const active = await findActiveShipments("manual");
  for (const shipment of active) {
    try {
      const res = await fetch(
        `https://api.trackcourier.io/v1/track?courier=${encodeURIComponent(courier)}&tracking_number=${encodeURIComponent(shipment.awb!)}`,
        { headers: { "X-API-Key": apiKey }, signal: AbortSignal.timeout(20000) },
      );
      if (!res.ok) {
        console.error("[tracking-sync] trackcourier", shipment.awb, res.status);
        continue;
      }
      const data = (await res.json()) as {
        current_status?: string;
        checkpoints?: TrackCourierCheckpoint[];
      };

      const seen = new Set(shipment.events.map((e) => `${e.occurredAt.getTime()}|${e.description}`));
      for (const c of data.checkpoints ?? []) {
        if (!c.status) continue;
        const occurredAt = c.checkpoint_time ? new Date(c.checkpoint_time) : new Date();
        if (Number.isNaN(occurredAt.getTime())) continue;
        const key = `${occurredAt.getTime()}|${c.status}`;
        if (seen.has(key)) continue;
        await db.shipmentEvent.create({
          data: {
            shipmentId: shipment.id,
            status: "TRACKING",
            description: c.status,
            location: c.location ?? null,
            occurredAt,
          },
        });
      }

      const mapped = mapManualStatus(data.current_status ?? "");
      if (!mapped) continue;
      await applyStatus(shipment, mapped, "Courier update (DTDC)");
    } catch (err) {
      console.error("[tracking-sync] manual AWB", shipment.awb, err);
    }
  }
}
