import { NextResponse } from "next/server";
import { z } from "zod";

import { getSetting } from "@/lib/catalog";

const bodySchema = z.object({
  pincode: z.string().regex(/^[1-9][0-9]{5}$/),
  weightGrams: z.number().int().positive().max(50_000).default(350),
});

/**
 * Zone-table estimate from the Hyderabad origin. M7 swaps the internals for
 * the Shiprocket serviceability API (with a 24h cache); the response shape
 * stays the same so the UI never changes.
 */
const zones: Record<string, [number, number]> = {
  "5": [2, 4], // Telangana / AP / Karnataka
  "4": [3, 5], // Maharashtra / MP / Goa
  "6": [3, 5], // TN / Kerala
  "3": [4, 6], // Gujarat / Rajasthan
  "1": [4, 6], // Delhi / North
  "2": [4, 7], // UP / Uttarakhand
  "7": [5, 7], // East / NE
  "8": [5, 8], // Bihar / Jharkhand / NE
  "9": [6, 9], // APS
};

export async function POST(request: Request) {
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: "Enter a valid 6-digit Indian pincode" },
      { status: 400 },
    );
  }
  const { pincode } = parsed.data;
  const [etaDaysMin, etaDaysMax] = zones[pincode[0]] ?? [4, 8];

  const flatFee = await getSetting<number>("shipping_flat_fee", 6000);

  return NextResponse.json({
    ok: true,
    etaDaysMin,
    etaDaysMax,
    charge: flatFee,
    source: "zone-table",
  });
}
