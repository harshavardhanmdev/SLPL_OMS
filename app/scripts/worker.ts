/**
 * SLPL Store background worker — runs as its own container (oms-worker).
 *
 * Jobs:
 *  - every 10 min: release expired stock reservations + reconcile pending
 *    Razorpay payments (heals interrupted payments / missed webhooks)
 *  - every 3 h:    sync Shiprocket tracking → order statuses + emails
 *
 * Start: npx tsx scripts/worker.ts   (NODE_OPTIONS=--conditions=react-server)
 */
import "dotenv/config";
import cron from "node-cron";

import { releaseExpiredOrders, reconcilePendingPayments } from "../src/lib/orders";
import { syncShipmentTracking } from "../src/lib/shipping/tracking-sync";

const log = (...args: unknown[]) => console.log(new Date().toISOString(), "[worker]", ...args);

async function paymentsTick() {
  try {
    const released = await releaseExpiredOrders();
    if (released > 0) log(`released ${released} expired reservation(s)`);
    await reconcilePendingPayments();
  } catch (err) {
    console.error("[worker] payments tick failed", err);
  }
}

async function trackingTick() {
  try {
    await syncShipmentTracking();
  } catch (err) {
    console.error("[worker] tracking tick failed", err);
  }
}

log("starting — payments every 10 min, tracking every 3 h");
void paymentsTick();
void trackingTick();

cron.schedule("*/10 * * * *", paymentsTick);
cron.schedule("0 */3 * * *", trackingTick);

process.on("SIGTERM", () => {
  log("SIGTERM — bye");
  process.exit(0);
});
