import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { getStaff, roleCan } from "@/lib/staff-auth";
import { fetchAppReceipt } from "@/lib/team-expenses";

export const runtime = "nodejs";

/**
 * The photo of a bill taken in the Team Expenses app, fetched from the app's
 * server with its key. Only the person who claimed it and the owners who
 * approve claims may see it.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const staff = await getStaff();
  if (!staff) return NextResponse.json({ error: "Sign in" }, { status: 401 });
  const { id } = await params;

  const claim = await db.expenseClaim.findUnique({ where: { externalId: id }, select: { claimedById: true } });
  if (!claim) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (claim.claimedById !== staff.id && !roleCan(staff.role, "staff.manage")) {
    return NextResponse.json({ error: "Not yours" }, { status: 403 });
  }

  const photo = await fetchAppReceipt(id);
  if (!photo) return NextResponse.json({ error: "The app has no photo for this bill" }, { status: 404 });
  return new Response(photo, {
    headers: { "Content-Type": "image/jpeg", "Cache-Control": "private, max-age=300" },
  });
}
