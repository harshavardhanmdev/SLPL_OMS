"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { audit } from "@/lib/audit";
import { db } from "@/lib/db";
import { getStaff, requireCapability } from "@/lib/staff-auth";
import { MOVE_KINDS, signFor, type MoveKind } from "@/lib/stock-moves";

/**
 * Recording what moved.
 *
 * Nothing is ever deleted or edited. A mistake is reversed by its own line
 * with a reason, because a statement that has gone to a bank cannot have its
 * history quietly rewritten underneath it.
 */

type Result = { ok?: boolean; error?: string; ref?: string };

const DENIED: Record<string, string> = {
  UNAUTHORIZED: "Sign in again to record a movement.",
  FORBIDDEN: "Your role can read the register but not change it.",
};

/** SLPL-M-YYMM-XXXXX, so a line can be quoted in a letter to the bank. */
async function generateRef(movedAt: Date): Promise<string> {
  const stamp = `${String(movedAt.getFullYear()).slice(2)}${String(movedAt.getMonth() + 1).padStart(2, "0")}`;
  for (let i = 0; i < 5; i++) {
    const candidate = `SLPL-M-${stamp}-${randomBytes(3).toString("hex").toUpperCase().slice(0, 5)}`;
    const clash = await db.stockMovement.findUnique({ where: { ref: candidate } });
    if (!clash) return candidate;
  }
  throw new Error("Could not allocate a movement number - please retry.");
}

const schema = z.object({
  movedAt: z.string().min(1, "Pick the date it moved"),
  kind: z.string().min(1),
  label: z.string().trim().min(2, "Pick the register line").max(80),
  series: z.string().trim().max(60).optional().or(z.literal("")),
  unit: z.enum(["SET", "COPY"]),
  quantity: z.number().int().min(1, "Enter how many").max(1_000_000),
  /** ADJUSTMENT only: whether the correction adds to the shelf or takes away. */
  increases: z.boolean().optional(),
  quantityTelugu: z.number().int().min(0).max(1_000_000).nullable().optional(),
  quantityHindi: z.number().int().min(0).max(1_000_000).nullable().optional(),
  party: z.string().trim().max(120).optional().or(z.literal("")),
  document: z.string().trim().max(80).optional().or(z.literal("")),
  note: z.string().trim().max(500).optional().or(z.literal("")),
});

export type MovementInput = z.infer<typeof schema>;

export async function recordMovement(input: MovementInput): Promise<Result> {
  const denied = await requireCapability("finance.write");
  if (denied) return { error: DENIED[denied] };
  const staff = await getStaff();
  if (!staff) return { error: DENIED.UNAUTHORIZED };

  const parsed = schema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const d = parsed.data;

  if (!MOVE_KINDS.some((k) => k.value === d.kind)) return { error: "Pick what kind of movement." };
  const kind = d.kind as MoveKind;

  const movedAt = new Date(d.movedAt);
  if (Number.isNaN(movedAt.getTime())) return { error: "That date is not valid." };
  if (movedAt > new Date()) return { error: "That date is in the future." };

  // ADJUSTMENT carries its own direction; everything else is decided by kind
  const sign = kind === "ADJUSTMENT" ? (d.increases === false ? -1 : 1) : signFor(kind);
  const languageSign = sign;

  const row = await db.stockMovement.create({
    data: {
      ref: await generateRef(movedAt),
      movedAt,
      kind,
      label: d.label,
      series: d.series || null,
      unit: d.unit,
      quantity: d.quantity * sign,
      quantityTelugu: d.quantityTelugu ? d.quantityTelugu * languageSign : null,
      quantityHindi: d.quantityHindi ? d.quantityHindi * languageSign : null,
      party: d.party || null,
      document: d.document || null,
      note: d.note || null,
      recordedById: staff.breakGlass ? null : staff.id,
      recordedEmail: staff.email,
    },
  });

  await audit({
    action: "stock.movement",
    entityType: "StockMovement",
    entityId: row.id,
    after: {
      ref: row.ref,
      kind: row.kind,
      label: row.label,
      quantity: row.quantity,
      party: row.party,
      movedAt: row.movedAt.toISOString(),
    },
  });

  revalidatePath("/erp/stock");
  revalidatePath("/erp/stock/movements");
  revalidatePath("/erp/stock/statement");
  return { ok: true, ref: row.ref };
}

const voidSchema = z.object({
  id: z.string().min(1),
  reason: z.string().trim().min(3, "Say why, it goes in the audit trail").max(200),
});

/** Voided, never deleted, so the register has no silent gaps. */
export async function voidMovement(input: z.infer<typeof voidSchema>): Promise<Result> {
  const denied = await requireCapability("finance.write");
  if (denied) return { error: DENIED[denied] };

  const parsed = voidSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const before = await db.stockMovement.findUnique({ where: { id: parsed.data.id } });
  if (!before) return { error: "That movement no longer exists." };
  if (before.voidedAt) return { error: "That movement is already void." };

  await db.stockMovement.update({
    where: { id: parsed.data.id },
    data: { voidedAt: new Date(), voidReason: parsed.data.reason },
  });

  await audit({
    action: "stock.movement.void",
    entityType: "StockMovement",
    entityId: parsed.data.id,
    before: { ref: before.ref, quantity: before.quantity, label: before.label },
    after: { reason: parsed.data.reason },
  });

  revalidatePath("/erp/stock");
  revalidatePath("/erp/stock/movements");
  revalidatePath("/erp/stock/statement");
  return { ok: true, ref: before.ref };
}
