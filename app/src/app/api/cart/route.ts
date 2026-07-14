import { NextResponse } from "next/server";
import { z } from "zod";

import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";

/**
 * Server copy of the cart for logged-in users (cross-device persistence).
 * The client store stays the source of truth for the UI; checkout re-validates
 * everything against the live catalog regardless.
 */

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ lines: [] });

  const cart = await db.cart.findUnique({
    where: { userId: session.uid },
    include: {
      items: {
        include: {
          product: {
            select: { id: true, slug: true, title: true, price: true, coverImage: true, isVisible: true },
          },
        },
      },
    },
  });

  const lines =
    cart?.items
      .filter((i) => i.product.isVisible)
      .map((i) => ({
        productId: i.product.id,
        slug: i.product.slug,
        title: i.product.title,
        unitPrice: i.product.price,
        image: i.product.coverImage,
        quantity: i.quantity,
      })) ?? [];

  return NextResponse.json({ lines });
}

const putSchema = z.object({
  lines: z
    .array(
      z.object({
        productId: z.string().min(1),
        quantity: z.number().int().min(1).max(99),
      }),
    )
    .max(100),
});

export async function PUT(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ ok: false }, { status: 401 });

  const parsed = putSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false }, { status: 400 });

  // Keep only products that actually exist and are visible
  const products = await db.product.findMany({
    where: { id: { in: parsed.data.lines.map((l) => l.productId) }, isVisible: true },
    select: { id: true },
  });
  const validIds = new Set(products.map((p) => p.id));
  const lines = parsed.data.lines.filter((l) => validIds.has(l.productId));

  await db.$transaction(async (tx) => {
    const cart = await tx.cart.upsert({
      where: { userId: session.uid },
      update: {},
      create: { userId: session.uid },
    });
    await tx.cartItem.deleteMany({ where: { cartId: cart.id } });
    if (lines.length > 0) {
      await tx.cartItem.createMany({
        data: lines.map((l) => ({ cartId: cart.id, productId: l.productId, quantity: l.quantity })),
      });
    }
  });

  return NextResponse.json({ ok: true });
}
