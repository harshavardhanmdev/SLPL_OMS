/**
 * SLPL Store background worker — runs as its own container (oms-worker).
 *
 * Jobs:
 *  - every 10 min: release expired stock reservations + reconcile pending
 *    Razorpay payments (heals interrupted payments / missed webhooks)
 *  - every 3 h:    sync Shiprocket tracking → order statuses + emails
 *  - daily 9 am:   email the owner any grievance past its statutory deadline
 *
 * Start: npx tsx scripts/worker.ts   (NODE_OPTIONS=--conditions=react-server)
 */
import "dotenv/config";
import cron from "node-cron";

import { releaseExpiredOrders, reconcilePendingPayments } from "../src/lib/orders";
import { syncShipmentTracking } from "../src/lib/shipping/tracking-sync";
import { reportOverdueGrievances } from "../src/lib/grievance-sla";
import { remindExpiringSubscriptions } from "../src/lib/subscription-notify";

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

async function subscriptionTick() {
  try {
    const warned = await remindExpiringSubscriptions();
    if (warned > 0) log(`${warned} subscription(s) nearing the end of their term - reader notified`);
  } catch (err) {
    console.error("[worker] subscription renewal tick failed", err);
  }
}

async function grievanceSlaTick() {
  try {
    const overdue = await reportOverdueGrievances();
    if (overdue > 0) log(`${overdue} grievance(s) past deadline - owner notified`);
  } catch (err) {
    console.error("[worker] grievance SLA tick failed", err);
  }
}

log("starting - payments every 10 min, tracking every 3 h, grievance SLA daily");
void paymentsTick();
void trackingTick();

cron.schedule("*/10 * * * *", paymentsTick);
cron.schedule("0 */3 * * *", trackingTick);
// 9 am IST, so an overdue complaint lands at the start of the working day
cron.schedule("0 9 * * *", grievanceSlaTick);
// 10 am, after the grievance digest, so the two never collide
cron.schedule("0 10 * * *", subscriptionTick);

process.on("SIGTERM", () => {
  log("SIGTERM — bye");
  process.exit(0);
});
