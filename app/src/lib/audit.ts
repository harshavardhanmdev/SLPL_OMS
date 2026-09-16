import "server-only";

import { headers } from "next/headers";

import { db } from "@/lib/db";
import { getStaff } from "@/lib/staff-auth";

/**
 * The audit trail. Every write that touches money or stock goes through here,
 * so "who changed this price, and when" is a query rather than a feature to
 * add later.
 *
 * The actor's email is stored alongside the relation, so the trail survives a
 * staff row being deleted. Logging never throws: losing an audit line is bad,
 * but failing the user's action because the log failed is worse.
 */
export async function audit(entry: {
  action: string;
  entityType?: string;
  entityId?: string;
  before?: unknown;
  after?: unknown;
}): Promise<void> {
  try {
    const staff = await getStaff();
    const h = await headers();
    await db.adminAuditLog.create({
      data: {
        adminUserId: staff && !staff.breakGlass ? staff.id : null,
        actorEmail: staff?.email ?? "unknown",
        action: entry.action,
        entityType: entry.entityType ?? null,
        entityId: entry.entityId ?? null,
        before: (entry.before ?? null) as never,
        after: (entry.after ?? null) as never,
        ip: h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
      },
    });
  } catch (err) {
    console.error("[audit] could not record", entry.action, err);
  }
}
