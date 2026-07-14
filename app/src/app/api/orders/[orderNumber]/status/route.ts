import { NextResponse } from "next/server";

import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ orderNumber: string }> },
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ ok: false }, { status: 401 });

  const { orderNumber } = await params;
  const order = await db.order.findFirst({
    where: { orderNumber, userId: session.uid },
    select: { status: true, total: true, updatedAt: true },
  });
  if (!order) return NextResponse.json({ ok: false }, { status: 404 });
  return NextResponse.json({ ok: true, ...order });
}
