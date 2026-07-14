import "server-only";

import { getSetting } from "@/lib/catalog";

/**
 * Delivery estimate from the Hyderabad origin. Zone-table fallback now; the
 * Shiprocket adapter (M7) replaces the internals behind the same signature.
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
  source: string;
};

export async function estimateDelivery(
  pincode: string,
  _weightGrams: number,
  subtotal = 0,
): Promise<DeliveryQuote | null> {
  if (!PINCODE_RE.test(pincode)) return null;
  const [etaDaysMin, etaDaysMax] = zones[pincode[0]] ?? [4, 8];

  const [flatFee, freeThreshold] = await Promise.all([
    getSetting<number>("shipping_flat_fee", 6000),
    getSetting<number>("free_shipping_threshold", 0),
  ]);
  const charge = freeThreshold > 0 && subtotal >= freeThreshold ? 0 : flatFee;

  return { etaDaysMin, etaDaysMax, charge, source: "zone-table" };
}
