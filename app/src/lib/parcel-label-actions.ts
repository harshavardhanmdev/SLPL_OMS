"use server";

import { z } from "zod";

import { audit } from "@/lib/audit";
import { allocateCustomerCode } from "@/lib/customer-code";
import { db } from "@/lib/db";
import { nextParcelNumber } from "@/lib/number-series";
import { getStaff, requireCapability } from "@/lib/staff-auth";
import { normalizeIssue } from "@/lib/subscription-plans";

/**
 * Turning a selection into labels. A pick without a label gets one, with the
 * next parcel number; a pick that already has one keeps it, so printing twice
 * never gives one parcel two numbers. A store customer without a customer code
 * is given one the first time a parcel of theirs is labelled.
 */

type Result = { error?: string; ids?: string[] };

const DENIED: Record<string, string> = {
  UNAUTHORIZED: "Sign in again to print labels.",
  FORBIDDEN: "Your role cannot print parcel labels.",
};

const schema = z.object({
  issue: z.string().transform((text, ctx) => {
    const issue = normalizeIssue(text);
    if (!issue) ctx.addIssue({ code: "custom", message: "Pick the issue first." });
    return issue ?? z.NEVER;
  }),
  picks: z
    .array(z.object({ kind: z.enum(["order", "subscription", "label"]), id: z.string().min(1).max(40) }))
    .min(1, "Tick at least one to print.")
    .max(200, "Print at most 200 at a time."),
});

export async function prepareLabels(input: z.infer<typeof schema>): Promise<Result> {
  const denied = await requireCapability("shipments.manage");
  if (denied) return { error: DENIED[denied] };
  const staff = (await getStaff())!;
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the selection." };
  const { issue } = parsed.data;
  const picks = parsed.data.picks.filter(
    (p, i, all) => all.findIndex((q) => q.kind === p.kind && q.id === p.id) === i,
  );
  const idsOf = (kind: string) => picks.filter((p) => p.kind === kind).map((p) => p.id);

  const user = { select: { id: true, name: true, customerCode: true, createdAt: true } };
  const [orders, subs, labels] = await Promise.all([
    db.order.findMany({
      where: { id: { in: idsOf("order") } },
      select: { id: true, fulfilment: true, shippingAddress: true, user },
    }),
    db.subscription.findMany({
      where: { id: { in: idsOf("subscription") } },
      select: { id: true, code: true, status: true, city: true, invoiceId: true, user },
    }),
    db.parcelLabel.findMany({ where: { id: { in: idsOf("label") } }, select: { id: true } }),
  ]);
  if (
    orders.length !== idsOf("order").length ||
    subs.length !== idsOf("subscription").length ||
    labels.length !== idsOf("label").length
  ) {
    return { error: "Some of those are no longer there. Refresh the page and tick them again." };
  }
  if (orders.some((o) => o.fulfilment !== "SHIP"))
    return { error: "A kit is collected at the school, not posted." };
  // A term that has just finished still gets the label for its last issue
  const stopped = subs.find((s) => s.status !== "ACTIVE" && s.status !== "COMPLETED");
  if (stopped) return { error: `${stopped.code} is not running, so nothing is posted to it.` };

  // A school's subscription carries the school's code; a reader needs their own
  const codeless = new Map<string, { name: string; city: string; added: Date }>();
  for (const o of orders) {
    const city = (o.shippingAddress as { city?: string }).city ?? "";
    if (!o.user.customerCode) codeless.set(o.user.id, { name: o.user.name, city, added: o.user.createdAt });
  }
  for (const s of subs) {
    if (!s.invoiceId && s.user && !s.user.customerCode) {
      codeless.set(s.user.id, { name: s.user.name, city: s.city, added: s.user.createdAt });
    }
  }

  const now = new Date();
  const made: string[] = [];
  let ids: string[];
  try {
    for (const [id, c] of codeless) {
      const code = await allocateCustomerCode(c.name, c.city, c.added);
      await db.user.update({ where: { id }, data: { customerCode: code } });
    }
    ids = await db.$transaction(async (tx) => {
      const out: string[] = [];
      for (const p of picks) {
        if (p.kind === "label") {
          out.push(p.id);
          continue;
        }
        const existing = await tx.parcelLabel.findUnique({
          where:
            p.kind === "order"
              ? { orderId: p.id }
              : { subscriptionId_issueLabel: { subscriptionId: p.id, issueLabel: issue } },
          select: { id: true },
        });
        if (existing) {
          out.push(existing.id);
          continue;
        }
        const label = await tx.parcelLabel.create({
          data: {
            number: await nextParcelNumber(tx, now),
            orderId: p.kind === "order" ? p.id : null,
            subscriptionId: p.kind === "subscription" ? p.id : null,
            issueLabel: p.kind === "subscription" ? issue : null,
            createdEmail: staff.email,
          },
        });
        made.push(label.number);
        out.push(label.id);
      }
      return out;
    });
  } catch (err) {
    if ((err as { code?: string }).code === "P2002") {
      return { error: "Someone else printed one of these at the same moment. Press Print again." };
    }
    throw err;
  }

  await audit({
    action: "label.print",
    entityType: "ParcelLabel",
    entityId: ids[0],
    after: { labels: ids.length, newNumbers: made, issue },
  });
  return { ids };
}
