import { NextResponse } from "next/server";

import { db } from "@/lib/db";

// GET handlers without dynamic APIs get executed at build time — this one
// needs the runtime database.
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await db.$queryRaw`SELECT 1`;
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false }, { status: 503 });
  }
}
