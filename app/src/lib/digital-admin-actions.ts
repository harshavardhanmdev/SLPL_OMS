"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { audit } from "@/lib/audit";
import { db } from "@/lib/db";
import { requireCapability } from "@/lib/staff-auth";

/**
 * Withdrawing a digital licence.
 *
 * Deliberately a human decision rather than an automatic lockout: mobile
 * networks rotate addresses all day, so a rule that counts them would throw out
 * paying readers. The view log is there to be read, and this is the lever.
 */

type Result = { ok?: boolean; error?: string };

const DENIED: Record<string, string> = {
  UNAUTHORIZED: "Sign in again.",
  FORBIDDEN: "Your role cannot change licences.",
};

const schema = z.object({
  id: z.string().min(1),
  reason: z.string().trim().min(3, "Say why, it goes in the audit trail").max(200),
});

export async function revokeLicence(input: z.infer<typeof schema>): Promise<Result> {
  const denied = await requireCapability("orders.manage");
  if (denied) return { error: DENIED[denied] };

  const parsed = schema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const before = await db.digitalEntitlement.findUnique({ where: { id: parsed.data.id } });
  if (!before) return { error: "That licence no longer exists." };
  if (before.revokedAt) return { error: "That licence is already withdrawn." };

  await db.digitalEntitlement.update({
    where: { id: parsed.data.id },
    data: { revokedAt: new Date(), revokeReason: parsed.data.reason },
  });

  await audit({
    action: "digital.revoke",
    entityType: "DigitalEntitlement",
    entityId: parsed.data.id,
    before: { code: before.code, revokedAt: null },
    after: { code: before.code, reason: parsed.data.reason },
  });
  revalidatePath("/erp/digital");
  return { ok: true };
}

export async function restoreLicence(id: string): Promise<Result> {
  const denied = await requireCapability("orders.manage");
  if (denied) return { error: DENIED[denied] };

  const before = await db.digitalEntitlement.findUnique({ where: { id } });
  if (!before) return { error: "That licence no longer exists." };
  if (!before.revokedAt) return { error: "That licence is already active." };

  await db.digitalEntitlement.update({
    where: { id },
    data: { revokedAt: null, revokeReason: null },
  });

  await audit({
    action: "digital.restore",
    entityType: "DigitalEntitlement",
    entityId: id,
    before: { code: before.code, reason: before.revokeReason },
    after: { code: before.code, revokedAt: null },
  });
  revalidatePath("/erp/digital");
  return { ok: true };
}
