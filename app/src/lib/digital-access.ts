import "server-only";

import { randomBytes } from "node:crypto";
import path from "node:path";
import { readFile } from "node:fs/promises";
import sharp from "sharp";

import { db } from "@/lib/db";

/**
 * Digital editions: who may read which issue, and the mark that makes a leak
 * name its source.
 *
 * A browser cannot stop a screenshot, a screen recording or a camera pointed at
 * the screen. What it can do is make sure the PDF never leaves the server, that
 * a page URL is useless to anybody but the buyer, and that every page carries
 * the buyer's name. Sharing a page is signing it. That is the deterrent; the
 * rest is a speed bump, and the copy we show customers says so.
 */

const UPLOADS_DIR = process.env.UPLOADS_DIR ?? path.join(process.cwd(), "uploads");
export const EDITIONS_DIR = path.join(UPLOADS_DIR, "editions");

/** The cutoff for "recently", used to count the addresses a licence was read from. */
export function daysAgo(days: number): Date {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

/** SLPL-D-YYMM-XXXXX, mirroring the order, receipt and subscription numbers. */
export async function generateLicenceCode(): Promise<string> {
  const now = new Date();
  const stamp = `${String(now.getFullYear()).slice(2)}${String(now.getMonth() + 1).padStart(2, "0")}`;
  for (let i = 0; i < 5; i++) {
    const candidate = `SLPL-D-${stamp}-${randomBytes(3).toString("hex").toUpperCase().slice(0, 5)}`;
    const clash = await db.digitalEntitlement.findUnique({ where: { code: candidate } });
    if (!clash) return candidate;
  }
  throw new Error("Could not allocate a licence code - please retry.");
}

/**
 * Grants a licence, once. The unique pair (userId, productId) means a webhook
 * arriving twice, or a reader paying twice by accident, still leaves one
 * licence with one code, so the watermark stays stable.
 */
export async function grantEntitlement(params: {
  userId: string;
  productId: string;
  orderId?: string | null;
}): Promise<{ id: string; code: string; created: boolean }> {
  const existing = await db.digitalEntitlement.findUnique({
    where: { userId_productId: { userId: params.userId, productId: params.productId } },
  });
  if (existing) {
    // A previously revoked licence is restored rather than duplicated
    if (existing.revokedAt) {
      await db.digitalEntitlement.update({
        where: { id: existing.id },
        data: { revokedAt: null, revokeReason: null },
      });
    }
    return { id: existing.id, code: existing.code, created: false };
  }

  const row = await db.digitalEntitlement.create({
    data: {
      code: await generateLicenceCode(),
      userId: params.userId,
      productId: params.productId,
      orderId: params.orderId ?? null,
    },
  });
  return { id: row.id, code: row.code, created: true };
}

export type Licence = {
  entitlementId: string;
  code: string;
  readerName: string;
  readerPhone: string;
  editionKey: string;
  pageCount: number;
  title: string;
};

/** The licence for this reader and this issue, or null if they cannot read it. */
export async function findLicence(userId: string, slug: string): Promise<Licence | null> {
  const product = await db.product.findFirst({
    where: { slug, kind: "DIGITAL" },
    select: { id: true, title: true, editionKey: true, pageCount: true },
  });
  if (!product?.editionKey || !product.pageCount) return null;

  const row = await db.digitalEntitlement.findUnique({
    where: { userId_productId: { userId, productId: product.id } },
    include: { user: { select: { name: true, phone: true } } },
  });
  if (!row || row.revokedAt) return null;

  return {
    entitlementId: row.id,
    code: row.code,
    readerName: row.user.name,
    readerPhone: row.user.phone ?? "",
    editionKey: product.editionKey,
    pageCount: product.pageCount,
    title: product.title,
  };
}

/** Escapes text going into the watermark SVG. A reader's name is their input. */
function xml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * The footer the owner chose: one discreet line, readable but out of the way.
 * Drawn over a translucent strip so it stays legible on a dark page and on a
 * white one.
 */
function watermarkSvg(width: number, licence: Licence): Buffer {
  const barHeight = Math.max(28, Math.round(width * 0.026));
  const fontSize = Math.round(barHeight * 0.46);
  const phone = licence.readerPhone ? ` · ${licence.readerPhone}` : "";
  const line = `Licensed to ${licence.readerName}${phone} · ${licence.code} · Not for redistribution`;

  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${barHeight}">
       <rect width="100%" height="100%" fill="#1E2A5A" fill-opacity="0.82"/>
       <text x="${Math.round(width / 2)}" y="${Math.round(barHeight * 0.66)}"
             text-anchor="middle" font-family="DejaVu Sans, Helvetica, Arial, sans-serif"
             font-size="${fontSize}" fill="#ffffff" fill-opacity="0.92"
             letter-spacing="0.4">${xml(line)}</text>
     </svg>`,
  );
}

/**
 * One page, watermarked for one reader.
 *
 * Composited per request rather than cached per buyer: sharp takes a few tens
 * of milliseconds, and caching would mean storing a copy of every issue for
 * every reader and then having to expire it when a licence is revoked.
 */
export async function renderPage(licence: Licence, page: number): Promise<Buffer> {
  const name = `p${String(page).padStart(3, "0")}.webp`;
  const file = path.join(EDITIONS_DIR, licence.editionKey, name);
  const source = await readFile(file);

  const image = sharp(source);
  const { width = 1800, height = 2330 } = await image.metadata();
  const bar = watermarkSvg(width, licence);
  const barHeight = Math.max(28, Math.round(width * 0.026));

  return image
    .composite([{ input: bar, top: Math.max(0, height - barHeight), left: 0 }])
    .webp({ quality: 80 })
    .toBuffer();
}

/** Fire and forget: losing a log line must never fail a page turn. */
export function recordView(
  entitlementId: string,
  page: number,
  ip: string | null,
  userAgent: string | null,
): void {
  void Promise.all([
    db.digitalViewLog.create({
      data: { entitlementId, page, ip, userAgent: userAgent?.slice(0, 300) ?? null },
    }),
    db.digitalEntitlement.update({
      where: { id: entitlementId },
      data: { viewCount: { increment: 1 }, lastViewedAt: new Date() },
    }),
  ]).catch((err) => console.error("[digital] could not record view", err));
}
