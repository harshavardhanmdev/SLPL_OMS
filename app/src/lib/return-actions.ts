"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { audit } from "@/lib/audit";
import { db } from "@/lib/db";
import { nextReturnNumber } from "@/lib/number-series";
import { getStaff, requireCapability } from "@/lib/staff-auth";

/**
 * Sales returns: goods a school sends back. The return's value comes off what
 * the school owes, less anything paid back to them, so their balance, the
 * payment form and the CA all see the same figure.
 */

type Result = { ok?: boolean; error?: string; id?: string; number?: string };

const lineSchema = z.object({
  description: z.string().trim().min(2, "Every line needs a description").max(200),
  hsnCode: z.string().trim().max(12).optional().or(z.literal("")),
  unit: z.string().trim().max(12).optional().or(z.literal("")),
  quantity: z.number().int().min(1, "Quantity must be at least one").max(1_000_000),
  /** Rupees as typed. */
  mrp: z.number().min(0).max(100_000_000).nullable(),
  rate: z.number().min(0).max(100_000_000),
});

const schema = z.object({
  organizationId: z.string().min(1, "Pick the school"),
  invoiceId: z.string().optional().nullable(),
  returnedOn: z.string().min(1, "Pick the return date"),
  /** Rupees paid back to the school. */
  refunded: z.number().min(0).max(100_000_000),
  reason: z.string().trim().max(500).optional().or(z.literal("")),
  lines: z.array(lineSchema).min(1, "Add at least one line").max(60),
});

export type ReturnInput = z.infer<typeof schema>;

export async function saveReturn(input: ReturnInput): Promise<Result> {
  const denied = await requireCapability("finance.write");
  if (denied)
    return { error: denied === "FORBIDDEN" ? "Your role cannot record a return." : "Sign in again." };
  const staff = await getStaff();
  if (!staff) return { error: "Sign in again." };

  const parsed = schema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const d = parsed.data;

  const org = await db.organization.findUnique({ where: { id: d.organizationId } });
  if (!org) return { error: "That school is no longer on record." };
  if (d.invoiceId) {
    const invoice = await db.invoice.findUnique({
      where: { id: d.invoiceId },
      select: { organizationId: true },
    });
    if (invoice?.organizationId !== org.id) return { error: "That bill is not one of this school's." };
  }
  const returnedOn = new Date(d.returnedOn);
  if (Number.isNaN(returnedOn.getTime())) return { error: "That date is not valid." };

  const items = d.lines.map((l, i) => {
    const rate = Math.round(l.rate * 100);
    return {
      description: l.description,
      hsnCode: l.hsnCode || null,
      unit: (l.unit || "SET").toUpperCase(),
      quantity: l.quantity,
      mrp: l.mrp == null ? null : Math.round(l.mrp * 100),
      rate,
      amount: rate * l.quantity,
      sortOrder: i,
    };
  });
  const total = items.reduce((s, i) => s + i.amount, 0);
  const refunded = Math.round(d.refunded * 100);
  if (refunded > total) return { error: "More cannot be paid back than the goods were worth." };

  const row = await db.$transaction(async (tx) =>
    tx.salesReturn.create({
      data: {
        number: await nextReturnNumber(tx, returnedOn),
        organizationId: org.id,
        invoiceId: d.invoiceId || null,
        returnedOn,
        customerName: org.name,
        phone: org.phone,
        placeOfSupply: org.state || "Telangana",
        reason: d.reason || null,
        total,
        refunded,
        createdEmail: staff.email,
        items: { create: items },
      },
    }),
  );
  await audit({
    action: "return.create",
    entityType: "SalesReturn",
    entityId: row.id,
    after: { number: row.number, school: org.name, total, refunded },
  });
  revalidatePath("/erp/returns");
  revalidatePath(`/erp/organizations/${org.id}`);
  return { ok: true, id: row.id, number: row.number };
}

/** An owner removes a return recorded by mistake. */
export async function deleteReturn(id: string): Promise<Result> {
  const denied = await requireCapability("staff.manage");
  if (denied)
    return { error: denied === "FORBIDDEN" ? "Only an owner can delete a return." : "Sign in again." };
  const row = await db.salesReturn.findUnique({ where: { id } });
  if (!row) return { error: "That return no longer exists." };
  await db.salesReturn.delete({ where: { id } });
  await audit({
    action: "return.delete",
    entityType: "SalesReturn",
    entityId: id,
    before: { number: row.number, total: row.total, refunded: row.refunded },
  });
  revalidatePath("/erp/returns");
  revalidatePath(`/erp/organizations/${row.organizationId}`);
  return { ok: true, number: row.number };
}
