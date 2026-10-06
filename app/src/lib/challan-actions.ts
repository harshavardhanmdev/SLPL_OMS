"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { audit } from "@/lib/audit";
import { getCompany } from "@/lib/company";
import { db } from "@/lib/db";
import { nextChallanNumber } from "@/lib/number-series";
import { getStaff, requireCapability } from "@/lib/staff-auth";

/**
 * The delivery challan that travels with the books.
 *
 * Once raised the goods on it are fixed, because the copy in the van and the
 * copy in the file must say the same thing. Only the transport details can
 * be filled in later, since the vehicle is rarely known when the challan is
 * raised.
 */

type Result = { ok?: boolean; error?: string; id?: string; number?: string };

function deniedMessage(denied: string): string {
  return denied === "FORBIDDEN" ? "Only a manager or an owner can raise a challan." : "Sign in again.";
}

const lineSchema = z.object({
  description: z.string().trim().min(1, "Every line needs a description").max(200),
  unit: z.string().trim().min(1, "Every line needs a unit").max(20),
  quantity: z.number().int().min(1, "Every line needs a quantity of at least 1").max(1_000_000),
});

const challanSchema = z.object({
  organizationId: z.string().optional().or(z.literal("")),
  invoiceId: z.string().optional().or(z.literal("")),
  dispatchedOn: z.string().min(1, "Pick the dispatch date"),
  fromAddress: z.string().trim().max(500).optional().or(z.literal("")),
  toName: z.string().trim().min(2, "Who is it going to?").max(120),
  toAddress: z.string().trim().min(5, "Where is it going?").max(500),
  transporter: z.string().trim().max(80).optional().or(z.literal("")),
  vehicleNumber: z.string().trim().max(20).optional().or(z.literal("")),
  notes: z.string().trim().max(500).optional().or(z.literal("")),
  lines: z.array(lineSchema).min(1, "Add at least one line"),
});

export type ChallanInput = z.infer<typeof challanSchema>;

export async function saveChallan(input: ChallanInput): Promise<Result> {
  const denied = await requireCapability("challan.write");
  if (denied) return { error: deniedMessage(denied) };
  const staff = await getStaff();
  if (!staff) return { error: "Sign in again." };

  const parsed = challanSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const d = parsed.data;

  const dispatchedOn = new Date(d.dispatchedOn);
  if (Number.isNaN(dispatchedOn.getTime())) return { error: "That date is not valid." };

  // A challan raised against a bill belongs to that bill's school
  let organizationId = d.organizationId || null;
  if (d.invoiceId) {
    const invoice = await db.invoice.findUnique({
      where: { id: d.invoiceId },
      select: { organizationId: true },
    });
    if (!invoice) return { error: "That invoice is not on the books." };
    organizationId = organizationId ?? invoice.organizationId;
  }

  const fromAddress = d.fromAddress || (await getCompany()).address;

  const row = await db.$transaction(async (tx) =>
    tx.deliveryChallan.create({
      data: {
        number: await nextChallanNumber(tx, dispatchedOn),
        organizationId,
        invoiceId: d.invoiceId || null,
        dispatchedOn,
        fromAddress,
        toName: d.toName,
        toAddress: d.toAddress,
        transporter: d.transporter || null,
        vehicleNumber: d.vehicleNumber ? d.vehicleNumber.toUpperCase() : null,
        notes: d.notes || null,
        recordedEmail: staff.email,
        items: {
          create: d.lines.map((l, i) => ({
            description: l.description,
            unit: l.unit,
            quantity: l.quantity,
            sortOrder: i,
          })),
        },
      },
    }),
  );

  await audit({
    action: "challan.create",
    entityType: "DeliveryChallan",
    entityId: row.id,
    after: {
      number: row.number,
      organizationId: row.organizationId,
      invoiceId: row.invoiceId,
      toName: row.toName,
      lines: d.lines,
    },
  });
  revalidatePath("/erp/challans");
  if (organizationId) revalidatePath(`/erp/organizations/${organizationId}`);
  if (d.invoiceId) revalidatePath(`/erp/invoices/${d.invoiceId}`);
  return { ok: true, id: row.id, number: row.number };
}

const transportSchema = z.object({
  id: z.string().min(1),
  transporter: z.string().trim().max(80).optional().or(z.literal("")),
  vehicleNumber: z.string().trim().max(20).optional().or(z.literal("")),
});

/** The one thing on a raised challan that may change: who is carrying it. */
export async function updateChallanTransport(input: z.infer<typeof transportSchema>): Promise<Result> {
  const denied = await requireCapability("challan.write");
  if (denied) return { error: deniedMessage(denied) };

  const parsed = transportSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const d = parsed.data;

  const before = await db.deliveryChallan.findUnique({
    where: { id: d.id },
    select: { transporter: true, vehicleNumber: true, organizationId: true },
  });
  if (!before) return { error: "That challan is not on the books." };

  const row = await db.deliveryChallan.update({
    where: { id: d.id },
    data: {
      transporter: d.transporter || null,
      vehicleNumber: d.vehicleNumber ? d.vehicleNumber.toUpperCase() : null,
    },
  });

  await audit({
    action: "challan.transport",
    entityType: "DeliveryChallan",
    entityId: row.id,
    before: { transporter: before.transporter, vehicleNumber: before.vehicleNumber },
    after: { transporter: row.transporter, vehicleNumber: row.vehicleNumber },
  });
  revalidatePath("/erp/challans");
  revalidatePath(`/erp/challans/${row.id}`);
  if (before.organizationId) revalidatePath(`/erp/organizations/${before.organizationId}`);
  return { ok: true, id: row.id, number: row.number };
}
