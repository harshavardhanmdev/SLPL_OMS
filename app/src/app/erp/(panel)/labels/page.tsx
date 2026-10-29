export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Printer, ScanBarcode } from "lucide-react";

import { IssuePicker } from "@/components/erp/issue-picker";
import { LabelPicker, type PickGroup } from "@/components/erp/label-picker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { db } from "@/lib/db";
import { labelQueue } from "@/lib/parcel-labels";
import { getStaff, roleCan } from "@/lib/staff-auth";
import { issueChoices, normalizeIssue, postingIssue } from "@/lib/subscription-plans";
import { dateTimeIN } from "@/lib/utils";

export const metadata: Metadata = { title: "Parcel labels", robots: { index: false } };

const ORDER_STAGE: Record<string, string> = {
  PAID: "paid, to pack",
  CONFIRMED: "cash on delivery, to pack",
  PROCESSING: "packing",
};

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
const dayMonth = (d: Date) => d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });

/**
 * Labels for everything that goes out by post or courier: GenZ Times issues
 * and store orders. Tick, print four to an A4 sheet, cut and paste on. The
 * barcode carries the label number, which the box at the top finds again.
 */
export default async function ParcelLabelsPage({
  searchParams,
}: {
  searchParams: Promise<{ issue?: string; find?: string }>;
}) {
  const staff = await getStaff();
  // Readers' and customers' addresses: whoever ships, which is the owners
  if (!staff || !roleCan(staff.role, "shipments.manage")) redirect("/erp");
  const { issue: rawIssue, find: rawFind } = await searchParams;
  const issue = (rawIssue && normalizeIssue(rawIssue)) || postingIssue();
  const choices = issueChoices();
  if (!choices.includes(issue)) choices.unshift(issue);
  const find = rawFind?.trim().toUpperCase() || "";

  const [{ subs, orders, recent }, found] = await Promise.all([
    labelQueue(issue),
    find
      ? db.parcelLabel.findUnique({
          where: { number: find },
          include: {
            order: { select: { orderNumber: true, customerName: true, status: true } },
            subscription: { select: { code: true, subscriberName: true } },
          },
        })
      : null,
  ]);

  const queued = new Set([
    ...subs.flatMap((s) => s.parcelLabels.map((l) => l.number)),
    ...orders.flatMap((o) => (o.parcelLabel ? [o.parcelLabel.number] : [])),
  ]);
  const groups: PickGroup[] = [
    {
      key: "subs",
      title: `The GenZ Times, ${issue} issue`,
      empty: `Nobody gets the ${issue} issue.`,
      rows: subs.map((s) => ({
        kind: "subscription",
        id: s.id,
        name: s.subscriberName,
        detail: `${s.city} ${s.pincode} · ${plural(s.copies, "copy", "copies")}`,
        reference: s.code,
        number: s.parcelLabels[0]?.number ?? null,
        status: s.dispatches[0] ? `Marked as posted on ${dayMonth(s.dispatches[0].sentAt)}` : null,
      })),
    },
    {
      key: "orders",
      title: "Store orders to send",
      empty: "No store orders are waiting to be sent.",
      rows: orders.map((o) => {
        const a = o.shippingAddress as { city?: string; pincode?: string };
        const items = o.items
          .filter((i) => i.product?.kind !== "DIGITAL")
          .reduce((n, i) => n + i.quantity, 0);
        return {
          kind: "order",
          id: o.id,
          name: o.customerName,
          detail: `${a.city ?? ""} ${a.pincode ?? ""} · ${plural(items, "item", "items")} · ${ORDER_STAGE[o.status] ?? o.status}`,
          reference: o.orderNumber,
          number: o.parcelLabel?.number ?? null,
          status: null,
        };
      }),
    },
    {
      key: "recent",
      title: "Printed in the last 30 days",
      empty: "No labels printed in the last 30 days.",
      rows: recent
        .filter((l) => !queued.has(l.number))
        .map((l) => ({
          kind: "label",
          id: l.id,
          name: l.order?.customerName ?? l.subscription?.subscriberName ?? "",
          detail: `${l.order ? `Order ${l.order.orderNumber}` : `GenZ Times, ${l.issueLabel}`} · printed ${dateTimeIN(l.createdAt)}`,
          reference: l.number,
          number: l.number,
          status: null,
        })),
    },
  ];

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div>
        <h1 className="font-heading text-2xl font-bold">Parcel labels</h1>
        <ol className="mt-2 grid gap-1.5 text-sm text-muted-foreground sm:grid-cols-3">
          {[
            "Pick the GenZ Times issue",
            "Tick who to send to",
            "Print, cut on the dashed lines, paste on",
          ].map((step, i) => (
            <li key={step} className="flex items-center gap-2">
              <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-navy text-xs font-semibold text-white">
                {i + 1}
              </span>
              {step}
            </li>
          ))}
        </ol>
      </div>

      <IssuePicker
        issue={issue}
        choices={choices}
        href="/erp/labels"
        question="Which GenZ Times issue are you sending?"
        hint="Four labels fit on one A4 sheet. A label printed again keeps its number. Store orders below are the same whichever issue you pick."
      />

      <div>
        <form className="rounded-2xl border bg-card p-4" action="/erp/labels">
          <label htmlFor="find" className="flex items-center gap-1.5 text-sm font-medium">
            <ScanBarcode className="size-4" /> Scan or type a label number
          </label>
          <div className="mt-2 flex gap-2">
            <Input
              id="find"
              name="find"
              defaultValue={find}
              placeholder="SL2610-00001"
              className="font-mono"
            />
            {rawIssue && <input type="hidden" name="issue" value={issue} />}
            <Button type="submit" variant="outline">
              Find
            </Button>
          </div>
        </form>
      </div>

      {find && (
        <div className="rounded-2xl border bg-card p-4">
          {!found ? (
            <p className="text-sm">
              No label numbered <b className="font-mono">{find}</b>.
            </p>
          ) : (
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-mono text-sm font-semibold">{found.number}</p>
                <p className="font-heading font-semibold">
                  {found.order?.customerName ?? found.subscription?.subscriberName}
                </p>
                <p className="text-sm text-muted-foreground">
                  {found.order ? (
                    <>
                      Store order{" "}
                      <Link href={`/admin/orders/${found.order.orderNumber}`} className="underline">
                        {found.order.orderNumber}
                      </Link>
                      , now {found.order.status.toLowerCase().replaceAll("_", " ")}
                    </>
                  ) : (
                    <>
                      The GenZ Times, {found.issueLabel} issue, subscription{" "}
                      <Link href="/erp/subscriptions" className="underline">
                        {found.subscription?.code}
                      </Link>
                    </>
                  )}
                </p>
                <p className="text-xs text-muted-foreground">
                  First printed {dateTimeIN(found.createdAt)} by {found.createdEmail}
                </p>
              </div>
              <Button variant="outline" className="gap-2" asChild>
                <Link href={`/erp/labels/print?ids=${found.id}`}>
                  <Printer className="size-4" /> Print again
                </Link>
              </Button>
            </div>
          )}
        </div>
      )}

      <LabelPicker issue={issue} groups={groups} />
    </div>
  );
}
