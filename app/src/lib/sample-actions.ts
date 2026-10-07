"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { audit } from "@/lib/audit";
import { db } from "@/lib/db";
import { getStaff, requireCapability, roleCan } from "@/lib/staff-auth";

/**
 * Specimen copies, followed from the office to a salesperson's bag and from
 * there, sometimes, to a school.
 *
 * They start in someone's hands rather than at a school, because that is how
 * the work goes: Harish takes twenty copies on Monday and hands them out over
 * the week, and some come back unopened. Handing over part of a batch splits
 * it, so what is still in the bag never gets lost inside a school's row.
 */

type Result = { ok?: boolean; error?: string; id?: string; pending?: boolean };

const DENIED: Record<string, string> = {
  UNAUTHORIZED: "Sign in again.",
  FORBIDDEN: "Your role cannot record samples.",
};

/** Whether this person may act on samples someone else is holding. */
async function mayHandle(holderId: string | null): Promise<string | null> {
  const staff = await getStaff();
  if (!staff) return DENIED.UNAUTHORIZED;
  if (roleCan(staff.role, "crm.manage")) return null;
  return holderId === staff.id ? null : "Only the person holding these, or a manager, can change them.";
}

function revalidate(organizationId?: string | null) {
  revalidatePath("/erp/samples");
  if (organizationId) revalidatePath(`/erp/organizations/${organizationId}`);
}

const takeSchema = z.object({
  description: z.string().trim().min(2, "Which title?").max(200),
  productId: z.string().optional().nullable(),
  quantity: z.number().int().min(1, "How many?").max(10000),
  issuedOn: z.string().min(1, "When were they taken?"),
  /** Who has them. A manager can record on someone's behalf; anyone else records their own. */
  holderId: z.string().optional().nullable(),
  /** Set when the copies went straight to a school. */
  organizationId: z.string().optional().nullable(),
  notes: z.string().trim().max(500).optional().or(z.literal("")),
});

export async function takeSamples(input: z.infer<typeof takeSchema>): Promise<Result> {
  const denied = await requireCapability("crm.write");
  if (denied) return { error: DENIED[denied] };
  const staff = await getStaff();
  if (!staff) return { error: DENIED.UNAUTHORIZED };

  const parsed = takeSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const d = parsed.data;

  const issuedOn = new Date(d.issuedOn);
  if (Number.isNaN(issuedOn.getTime())) return { error: "That date is not valid." };

  // Recording for someone else is a manager's job
  let holderId: string | null = staff.breakGlass ? null : staff.id;
  let holderEmail = staff.email;
  if (d.holderId && d.holderId !== staff.id) {
    if (!roleCan(staff.role, "crm.manage")) {
      return { error: "Only a manager can record samples someone else is carrying." };
    }
    const holder = await db.adminUser.findUnique({ where: { id: d.holderId } });
    if (!holder) return { error: "That person no longer has an account." };
    holderId = holder.id;
    holderEmail = holder.email;
  }

  // An executive's batch waits for the manager; a manager's stands as saved
  const approver = roleCan(staff.role, "crm.manage");

  const row = await db.sampleIssue.create({
    data: {
      description: d.description,
      productId: d.productId || null,
      quantity: d.quantity,
      issuedOn,
      issuedById: holderId,
      issuedEmail: holderEmail,
      organizationId: d.organizationId || null,
      status: d.organizationId ? "WITH_SCHOOL" : "IN_HAND",
      givenOn: d.organizationId ? issuedOn : null,
      notes: d.notes || null,
      approvalStatus: approver ? "APPROVED" : "PENDING",
      approvedById: approver && !staff.breakGlass ? staff.id : null,
      approvedAt: approver ? new Date() : null,
    },
  });

  await audit({
    action: "sample.take",
    entityType: "SampleIssue",
    entityId: row.id,
    after: {
      description: row.description,
      quantity: row.quantity,
      holder: holderEmail,
      organizationId: row.organizationId,
      approvalStatus: row.approvalStatus,
    },
  });
  revalidate(row.organizationId);
  revalidatePath("/erp/approvals");
  return { ok: true, id: row.id, pending: row.approvalStatus === "PENDING" };
}

const giveSchema = z.object({
  id: z.string().min(1),
  organizationId: z.string().min(1, "Which school?"),
  quantity: z.number().int().min(1, "How many?"),
  givenOn: z.string().min(1, "When?"),
});

/** Hand some or all of a batch to a school. Part of a batch splits it. */
export async function giveSamples(input: z.infer<typeof giveSchema>): Promise<Result> {
  const denied = await requireCapability("crm.write");
  if (denied) return { error: DENIED[denied] };

  const parsed = giveSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const d = parsed.data;

  const batch = await db.sampleIssue.findUnique({ where: { id: d.id } });
  if (!batch) return { error: "Those samples are no longer on record." };
  if (batch.status !== "IN_HAND") return { error: "Only copies still in hand can be given out." };
  if (batch.approvalStatus === "PENDING") {
    return { error: "These are waiting for your manager's approval before they go to a school." };
  }
  if (batch.approvalStatus === "REJECTED") {
    return { error: "These were sent back, so they cannot go to a school." };
  }
  const blocked = await mayHandle(batch.issuedById);
  if (blocked) return { error: blocked };
  if (d.quantity > batch.quantity) {
    return { error: `Only ${batch.quantity} of these are in hand.` };
  }
  const givenOn = new Date(d.givenOn);
  if (Number.isNaN(givenOn.getTime())) return { error: "That date is not valid." };

  const row = await db.$transaction(async (tx) => {
    if (d.quantity === batch.quantity) {
      return tx.sampleIssue.update({
        where: { id: batch.id },
        data: { status: "WITH_SCHOOL", organizationId: d.organizationId, givenOn },
      });
    }
    await tx.sampleIssue.update({
      where: { id: batch.id },
      data: { quantity: batch.quantity - d.quantity },
    });
    return tx.sampleIssue.create({
      data: {
        description: batch.description,
        productId: batch.productId,
        quantity: d.quantity,
        issuedById: batch.issuedById,
        issuedEmail: batch.issuedEmail,
        issuedOn: batch.issuedOn,
        status: "WITH_SCHOOL",
        organizationId: d.organizationId,
        givenOn,
        notes: batch.notes,
        // The split was approved along with the batch it came from
        approvalStatus: batch.approvalStatus,
        approvedById: batch.approvedById,
        approvedAt: batch.approvedAt,
        rejectedReason: batch.rejectedReason,
      },
    });
  });

  await audit({
    action: "sample.give",
    entityType: "SampleIssue",
    entityId: row.id,
    before: { batch: batch.id, inHand: batch.quantity },
    after: { organizationId: row.organizationId, quantity: row.quantity },
  });
  revalidate(row.organizationId);
  return { ok: true, id: row.id };
}

const settleSchema = z.object({
  id: z.string().min(1),
  status: z.enum(["IN_HAND", "RETURNED", "CONVERTED", "WRITTEN_OFF"]),
});

/** Came back to the office, became an order, or is gone for good. */
export async function settleSamples(input: z.infer<typeof settleSchema>): Promise<Result> {
  const denied = await requireCapability("crm.write");
  if (denied) return { error: DENIED[denied] };

  const parsed = settleSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const d = parsed.data;

  const before = await db.sampleIssue.findUnique({ where: { id: d.id } });
  if (!before) return { error: "Those samples are no longer on record." };
  const blocked = await mayHandle(before.issuedById);
  if (blocked) return { error: blocked };

  const row = await db.sampleIssue.update({
    where: { id: d.id },
    data: {
      status: d.status,
      returnedOn: d.status === "RETURNED" ? new Date() : null,
      // Putting copies back in the bag undoes the hand-over
      ...(d.status === "IN_HAND" ? { organizationId: null, givenOn: null } : {}),
    },
  });

  await audit({
    action: "sample.settle",
    entityType: "SampleIssue",
    entityId: row.id,
    before: { status: before.status },
    after: { status: row.status },
  });
  revalidate(before.organizationId);
  return { ok: true, id: row.id };
}

const decideSchema = z.object({
  id: z.string().min(1),
  decision: z.enum(["APPROVED", "REJECTED"]),
  reason: z.string().trim().max(200).optional().or(z.literal("")),
});

/** The manager approves an executive's batch, or sends it back with a reason. */
export async function decideSamples(input: z.infer<typeof decideSchema>): Promise<Result> {
  const denied = await requireCapability("crm.manage");
  if (denied) {
    return {
      error: denied === "FORBIDDEN" ? "Only a sales manager or an owner can do that." : DENIED.UNAUTHORIZED,
    };
  }
  const staff = await getStaff();
  if (!staff) return { error: DENIED.UNAUTHORIZED };

  const parsed = decideSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { id, decision, reason } = parsed.data;

  if (decision === "REJECTED" && !reason) {
    return { error: "Say why they are being sent back." };
  }
  const before = await db.sampleIssue.findUnique({ where: { id } });
  if (!before) return { error: "Those samples are no longer on record." };
  if (before.approvalStatus !== "PENDING") {
    return { error: "Only samples waiting for approval can be decided." };
  }

  const row = await db.sampleIssue.update({
    where: { id },
    data: {
      approvalStatus: decision,
      approvedById: decision === "APPROVED" && !staff.breakGlass ? staff.id : null,
      approvedAt: decision === "APPROVED" ? new Date() : null,
      rejectedReason: decision === "REJECTED" ? (reason ?? null) : null,
    },
  });

  await audit({
    action: `sample.${decision.toLowerCase()}`,
    entityType: "SampleIssue",
    entityId: row.id,
    before: { approvalStatus: before.approvalStatus },
    after: { approvalStatus: row.approvalStatus, reason: reason || null },
  });
  revalidate(row.organizationId);
  revalidatePath("/erp/approvals");
  return { ok: true, id: row.id };
}
