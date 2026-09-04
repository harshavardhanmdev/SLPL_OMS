import "server-only";

import { randomBytes } from "node:crypto";
import QRCode from "qrcode";

import { db } from "@/lib/db";

/**
 * Server-side school kit helpers.
 *
 * A parent pays for one named student's kit, we issue a receipt carrying a QR
 * code, and the school hands the kit over against that receipt. The QR encodes
 * the receipt's access token, exactly like the grievance tracking link, so
 * nobody can walk up with a guessed number and claim a kit.
 */

/** SLPL-K-YYMM-XXXXX, mirroring generateOrderNumber in lib/orders.ts */
export async function generateReceiptNumber(): Promise<string> {
  const now = new Date();
  const stamp = `${String(now.getFullYear()).slice(2)}${String(now.getMonth() + 1).padStart(2, "0")}`;
  for (let i = 0; i < 5; i++) {
    const rand = randomBytes(3).toString("hex").toUpperCase().slice(0, 5);
    const candidate = `SLPL-K-${stamp}-${rand}`;
    const clash = await db.kitPurchase.findUnique({ where: { receiptNumber: candidate } });
    if (!clash) return candidate;
  }
  throw new Error("Could not allocate a receipt number - please retry.");
}

/** 48 hex characters. The QR payload, and the only thing guarding a receipt. */
export function generateAccessToken(): string {
  return randomBytes(24).toString("hex");
}

export function appUrl(): string {
  return process.env.APP_URL ?? "https://store.theslpl.in";
}

export function receiptUrl(accessToken: string): string {
  return `${appUrl()}/kits/receipt/${accessToken}`;
}

/**
 * Inline SVG, so the receipt page and the print sheet need no image host and
 * no round trip. School staff scan it with any phone camera.
 */
export async function receiptQrSvg(accessToken: string, size = 190): Promise<string> {
  return QRCode.toString(receiptUrl(accessToken), {
    type: "svg",
    margin: 1,
    width: size,
    errorCorrectionLevel: "M",
  });
}

/** The academic year a kit sold today belongs to. Indian school year starts in June. */
export function currentAcademicYear(now = new Date()): string {
  const startYear = now.getMonth() >= 5 ? now.getFullYear() : now.getFullYear() - 1;
  return `${startYear}-${String((startYear + 1) % 100).padStart(2, "0")}`;
}

export const KIT_STATUS_META: Record<
  string,
  { label: string; tone: "amber" | "blue" | "green" | "grey"; help: string }
> = {
  PENDING: { label: "Awaiting payment", tone: "grey", help: "Payment has not come through yet." },
  PAID: { label: "Paid", tone: "amber", help: "Paid. The school can hand the kit over." },
  READY: { label: "Ready at school", tone: "blue", help: "The school has set this kit aside." },
  COLLECTED: { label: "Collected", tone: "green", help: "Handed over to the family." },
  CANCELLED: { label: "Cancelled", tone: "grey", help: "Cancelled and refunded." },
};

export function kitStatusLabel(status: string): string {
  return KIT_STATUS_META[status]?.label ?? status;
}
