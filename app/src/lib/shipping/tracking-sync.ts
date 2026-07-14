import "server-only";

import { db } from "@/lib/db";
import { emailDelivered, emailOutForDelivery } from "@/lib/shipment-notify";
import { isShiprocketConfigured, mapTrackingStatus, trackByAwb } from "@/lib/shipping/shiprocket";

/**
 * Worker job: poll Shiprocket for every active AWB, append new tracking
 * events, and advance order status (+ emails) on transitions.
 */
export async function syncShipmentTracking(): Promise<void> {
  if (!isShiprocketConfigured()) return;

  const active = await db.shipment.findMany({
    where: {
      provider: "shiprocket",
      awb: { not: null },
      status: { in: ["CREATED", "PICKUP_SCHEDULED", "IN_TRANSIT", "OUT_FOR_DELIVERY"] },
    },
    include: { order: true, events: { orderBy: { occurredAt: "desc" }, take: 30 } },
  });

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
      if (!mapped || mapped === shipment.status) continue;

      await db.shipment.update({ where: { id: shipment.id }, data: { status: mapped } });

      if (mapped === "OUT_FOR_DELIVERY" && shipment.order.status === "SHIPPED") {
        await db.$transaction([
          db.order.update({ where: { id: shipment.orderId }, data: { status: "OUT_FOR_DELIVERY" } }),
          db.orderEvent.create({
            data: { orderId: shipment.orderId, status: "OUT_FOR_DELIVERY", note: "Courier update" },
          }),
        ]);
        await emailOutForDelivery(shipment.order, shipment);
      } else if (mapped === "DELIVERED" && ["SHIPPED", "OUT_FOR_DELIVERY"].includes(shipment.order.status)) {
        await db.$transaction([
          db.order.update({ where: { id: shipment.orderId }, data: { status: "DELIVERED" } }),
          db.orderEvent.create({
            data: { orderId: shipment.orderId, status: "DELIVERED", note: "Courier update" },
          }),
        ]);
        await emailDelivered(shipment.order);
      } else if (mapped === "RTO") {
        await db.orderEvent.create({
          data: {
            orderId: shipment.orderId,
            status: "RTO",
            note: "Shipment returning to origin — check the Shiprocket panel",
          },
        });
      }
    } catch (err) {
      console.error("[tracking-sync] AWB", shipment.awb, err);
    }
  }
}
