import "server-only";

import { randomBytes } from "node:crypto";

import { db } from "@/lib/db";
import { getSetting } from "@/lib/catalog";
import { site } from "@/lib/site";

/**
 * Server-side grievance helpers. The pure vocabulary (categories, status
 * labels, SLA constants) lives in grievance-constants.ts so client components
 * can share it; this module adds everything that needs the database or env.
 */

export * from "@/lib/grievance-constants";

/** SLPL-G-YYMM-XXXXX, mirroring generateOrderNumber in lib/orders.ts */
export async function generateTicketNumber(): Promise<string> {
  const now = new Date();
  const stamp = `${String(now.getFullYear()).slice(2)}${String(now.getMonth() + 1).padStart(2, "0")}`;
  for (let i = 0; i < 5; i++) {
    const rand = randomBytes(3).toString("hex").toUpperCase().slice(0, 5);
    const candidate = `SLPL-G-${stamp}-${rand}`;
    const clash = await db.grievance.findUnique({ where: { ticketNumber: candidate } });
    if (!clash) return candidate;
  }
  throw new Error("Could not allocate a ticket number - please retry.");
}

/** 48 hex characters; the only thing standing between a stranger and a ticket. */
export function generateAccessToken(): string {
  return randomBytes(24).toString("hex");
}

/** The named officer published on the policy page; editable in admin settings. */
export async function getGrievanceOfficer(): Promise<{ name: string; email: string; phone: string }> {
  const [name, email, phone] = await Promise.all([
    getSetting<string>("grievance_officer_name", site.contact.person),
    getSetting<string>("grievance_officer_email", site.contact.email),
    getSetting<string>("grievance_officer_phone", site.contact.phone),
  ]);
  return { name, email, phone };
}

export function trackingUrl(accessToken: string): string {
  const base = process.env.APP_URL ?? "https://store.theslpl.in";
  return `${base}/grievance/track/${accessToken}`;
}
