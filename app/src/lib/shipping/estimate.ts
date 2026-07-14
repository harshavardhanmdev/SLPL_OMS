import "server-only";

import { db } from "@/lib/db";
import { getSetting } from "@/lib/catalog";
import { isShiprocketConfigured, serviceability } from "@/lib/shipping/estimate-source";

/**
 * Delivery estimate from the store's origin pincode.
 * Shiprocket serviceability when configured (cached 24h per pincode+weight
 * band); zone-table fallback otherwise or on API failure.
 */
const zones: Record<string, [number, number]> = {
  "5": [2, 4],
  "4": [3, 5],
  "6": [3, 5],
  "3": [4, 6],
  "1": [4, 6],
  "2": [4, 7],
  "7": [5, 7],
  "8": [5, 8],
  "9": [6, 9],
};

export const PINCODE_RE = /^[1-9][0-9]{5}$/;

export type DeliveryQuote = {
  etaDaysMin: number;
  etaDaysMax: number;
  charge: number; // paise
  courier?: string;
  source: string;
};

const weightBand = (grams: number) => Math.max(500, Math.ceil(grams / 500) * 500);

export async function estimateDelivery(
  pincode: string,
  weightGrams: number,
  subtotal = 0,
): Promise<DeliveryQuote | null> {
  if (!PINCODE_RE.test(pincode)) return null;

  const [flatFee, freeThreshold, originPincode] = await Promise.all([
    getSetting<number>("shipping_flat_fee", 6000),
    getSetting<number>("free_shipping_threshold", 0),
    getSetting<string>("origin_pincode", "500068"),
  ]);
  const freeShip = freeThreshold > 0 && subtotal >= freeThreshold;

  if (isShiprocketConfigured()) {
    const band = weightBand(weightGrams);
    const cacheKey = `${pincode}:${band}`;
    const cached = await db.deliveryEstimateCache.findUnique({ where: { key: cacheKey } });
    if (cached && cached.expiresAt > new Date()) {
      return {
        etaDaysMin: cached.etaDays,
        etaDaysMax: cached.etaDays + 2,
        charge: freeShip ? 0 : cached.charge,
        courier: cached.courier ?? undefined,
        source: "shiprocket-cache",
      };
    }
    try {
      const quotes = await serviceability({
        fromPincode: originPincode,
        toPincode: pincode,
        weightGrams: band,
        cod: false,
      });
      const best = quotes[0];
      if (best) {
        await db.deliveryEstimateCache.upsert({
          where: { key: cacheKey },
          update: {
            etaDays: best.etaDays,
            charge: best.ratePaise,
            courier: best.courier,
            expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
          },
          create: {
            key: cacheKey,
            etaDays: best.etaDays,
            charge: best.ratePaise,
            courier: best.courier,
            expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
          },
        });
        return {
          etaDaysMin: best.etaDays,
          etaDaysMax: best.etaDays + 2,
          charge: freeShip ? 0 : best.ratePaise,
          courier: best.courier,
          source: "shiprocket",
        };
      }
    } catch (err) {
      console.error("[estimate] shiprocket failed, using zone table", err);
    }
  }

  const [etaDaysMin, etaDaysMax] = zones[pincode[0]] ?? [4, 8];
  return { etaDaysMin, etaDaysMax, charge: freeShip ? 0 : flatFee, source: "zone-table" };
}
