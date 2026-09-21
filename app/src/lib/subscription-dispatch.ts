"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { audit } from "@/lib/audit";
import { db } from "@/lib/db";
import { requireCapability } from "@/lib/staff-auth";

/**
 * Recording that an issue went into the post.
 *
 * One row per subscriber per issue, so "did you send me October" has an answer
 * and the count of issues sent is never a guess. The unique index on
 * (subscriptionId, issueLabel) makes posting the same issue twice impossible,
 * which matters most when two people work through the list on the same morning.
 */

type Result = { ok?: boolean; error?: string; sent?: number; already?: number };

const issueSchema = z
  .string()
  .trim()
  .min(3, "Name the issue, for example October 2026")
  .max(40);

const DENIED: Record<string, string> = {
  UNAUTHORIZED: "Sign in again to record a dispatch.",
  FORBIDDEN: "Your role cannot record dispatches.",
};

function isDuplicate(err: unknown): boolean {
  return typeof err === "object" && err !== null && (err as { code?: string }).code === "P2002";
}

/**
 * Posts one issue to one subscriber. Returns false when that issue was already
 * recorded for them, so a bulk run can report it rather than fail.
 */
async function post(subscriptionId: string, issueLabel: string, note: string | null) {
  try {
    await db.$transaction(async (tx) => {
      await tx.subscriptionDispatch.create({ data: { subscriptionId, issueLabel, note } });
      const sub = await tx.subscription.update({
        where: { id: subscriptionId },
        data: { issuesSent: { increment: 1 } },
      });
      // The term ends when the last issue is in the post, not when the calendar
      // says so, because a late issue should not close a subscription early.
      if (sub.status === "ACTIVE" && sub.issuesSent >= sub.issuesTotal) {
        await tx.subscription.update({ where: { id: sub.id }, data: { status: "COMPLETED" } });
      }
    });
    return true;
  } catch (err) {
    if (isDuplicate(err)) return false;
    throw err;
  }
}

export async function recordDispatch(input: {
  subscriptionId: string;
  issue: string;
  note?: string;
}): Promise<Result> {
  const denied = await requireCapability("orders.manage");
  if (denied) return { error: DENIED[denied] };

  const parsed = issueSchema.safeParse(input.issue);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const sub = await db.subscription.findUnique({ where: { id: input.subscriptionId } });
  if (!sub) return { error: "That subscription no longer exists." };
  if (sub.status === "PENDING") return { error: "That subscription has not been paid for yet." };
  if (sub.issuesSent >= sub.issuesTotal) {
    return { error: `All ${sub.issuesTotal} issues of that term have already gone out.` };
  }

  const sent = await post(sub.id, parsed.data, input.note?.trim() || null);
  if (!sent) return { error: `${parsed.data} was already recorded for ${sub.code}.` };

  await audit({
    action: "subscription.dispatch",
    entityType: "Subscription",
    entityId: sub.id,
    after: { code: sub.code, issue: parsed.data },
  });
  revalidatePath("/erp/subscriptions");
  return { ok: true, sent: 1 };
}

/**
 * The whole posting run in one action: every active subscriber who is owed this
 * issue and has not already had it. Anyone already recorded is skipped quietly,
 * so the button is safe to press twice.
 */
export async function recordIssueForAll(issue: string): Promise<Result> {
  const denied = await requireCapability("orders.manage");
  if (denied) return { error: DENIED[denied] };

  const parsed = issueSchema.safeParse(issue);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const issueLabel = parsed.data;

  const due = await db.subscription.findMany({
    where: { status: "ACTIVE", dispatches: { none: { issueLabel } } },
    select: { id: true, issuesSent: true, issuesTotal: true },
  });

  let sent = 0;
  let already = 0;
  for (const sub of due) {
    if (sub.issuesSent >= sub.issuesTotal) continue;
    if (await post(sub.id, issueLabel, null)) sent++;
    else already++;
  }

  await audit({
    action: "subscription.dispatch.bulk",
    entityType: "Subscription",
    after: { issue: issueLabel, sent, already },
  });
  revalidatePath("/erp/subscriptions");
  return { ok: true, sent, already };
}

const addressSchema = z.object({
  id: z.string().min(1),
  subscriberName: z.string().trim().min(2, "Enter the subscriber's name").max(80),
  phone: z
    .string()
    .trim()
    .regex(/^[6-9][0-9]{9}$/, "Enter a valid 10-digit mobile number"),
  addressLine1: z.string().trim().min(3, "Enter the address").max(120),
  addressLine2: z.string().trim().max(120).optional().or(z.literal("")),
  city: z.string().trim().min(2, "Enter the city").max(60),
  state: z.string().trim().min(2, "Enter the state").max(60),
  pincode: z.string().regex(/^[1-9][0-9]{5}$/, "Enter a valid 6-digit pincode"),
});

/**
 * The welcome email tells readers to reply with their subscription number when
 * they move, so there has to be somewhere to act on that reply.
 */
export async function updateSubscriberAddress(
  input: z.infer<typeof addressSchema>,
): Promise<Result> {
  const denied = await requireCapability("orders.manage");
  if (denied) return { error: DENIED[denied] };

  const parsed = addressSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { id, ...address } = parsed.data;

  const before = await db.subscription.findUnique({ where: { id } });
  if (!before) return { error: "That subscription no longer exists." };

  const after = await db.subscription.update({
    where: { id },
    data: { ...address, addressLine2: address.addressLine2 || null },
  });

  await audit({
    action: "subscription.address",
    entityType: "Subscription",
    entityId: id,
    before: {
      subscriberName: before.subscriberName,
      phone: before.phone,
      addressLine1: before.addressLine1,
      addressLine2: before.addressLine2,
      city: before.city,
      state: before.state,
      pincode: before.pincode,
    },
    after: {
      subscriberName: after.subscriberName,
      phone: after.phone,
      addressLine1: after.addressLine1,
      addressLine2: after.addressLine2,
      city: after.city,
      state: after.state,
      pincode: after.pincode,
    },
  });
  revalidatePath("/erp/subscriptions");
  return { ok: true };
}
