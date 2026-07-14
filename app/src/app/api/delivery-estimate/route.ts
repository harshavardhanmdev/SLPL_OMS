import { NextResponse } from "next/server";
import { z } from "zod";

import { estimateDelivery, PINCODE_RE } from "@/lib/shipping/estimate";

const bodySchema = z.object({
  pincode: z.string().regex(PINCODE_RE),
  weightGrams: z.number().int().positive().max(50_000).default(350),
  subtotal: z.number().int().nonnegative().default(0),
});

export async function POST(request: Request) {
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: "Enter a valid 6-digit Indian pincode" },
      { status: 400 },
    );
  }
  const { pincode, weightGrams, subtotal } = parsed.data;
  const quote = await estimateDelivery(pincode, weightGrams, subtotal);
  if (!quote) {
    return NextResponse.json({ ok: false, error: "We could not estimate for this pincode" }, { status: 422 });
  }
  return NextResponse.json({ ok: true, ...quote });
}
