export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Lock, Tags } from "lucide-react";

import { AddPriceItem, PriceLine } from "@/components/erp/price-editor";
import { db } from "@/lib/db";
import { formatINR } from "@/lib/money";
import { getStaff, roleCan } from "@/lib/staff-auth";

export const metadata: Metadata = { title: "Price list", robots: { index: false } };

/**
 * The rates that go on quotations and invoices.
 *
 * Kept apart from the online store on the owner's instruction, so repricing a
 * title for schools never moves what a parent pays on the website. Where a
 * group has a full set and its titles, the screen checks the titles add up to
 * the set, which is the mistake a handwritten price sheet invites.
 */
export default async function PricesPage() {
  const staff = await getStaff();
  if (!staff || !roleCan(staff.role, "quotes.read")) redirect("/erp");
  const canEdit = roleCan(staff.role, "staff.manage");

  const items = await db.priceListItem.findMany({
    where: canEdit ? {} : { isActive: true },
    // Groups appear in the order of their first item, so Nursery comes before LKG
    orderBy: [{ sortOrder: "asc" }, { description: "asc" }],
  });

  const groups = new Map<string, typeof items>();
  for (const item of items) {
    groups.set(item.group, [...(groups.get(item.group) ?? []), item]);
  }
  const names = [...groups.keys()];

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-heading text-2xl font-bold">Price list</h1>
          <p className="text-sm text-muted-foreground">
            What we quote schools. Separate from the online store, so changing a rate here never
            changes the website.
          </p>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs text-muted-foreground">
          <Lock className="size-3" /> Confidential, back office only
        </span>
      </div>

      {canEdit && <AddPriceItem groups={names} />}

      {items.length === 0 ? (
        <div className="rounded-2xl border bg-card p-10 text-center">
          <Tags className="mx-auto size-8 text-muted-foreground" />
          <p className="mt-3 font-medium">No prices yet.</p>
        </div>
      ) : (
        <div className="erp-stagger space-y-4">
          {[...groups.entries()].map(([name, rows]) => {
            // Only a group of one full set and its titles can be checked: a
            // group of sets for different grades has nothing to add up
            const isSet = (r: (typeof rows)[number]) => r.unit === "SET" && /full set/i.test(r.description);
            const sets = rows.filter(isSet);
            const set = sets.length === 1 ? sets[0] : undefined;
            const parts = rows.filter((r) => !isSet(r) && r.isActive);
            const partsTotal = parts.reduce((s, r) => s + r.rate, 0);
            const checks = set && parts.length > 1;
            return (
              <section key={name} className="overflow-hidden rounded-2xl border bg-card">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b bg-muted/30 px-4 py-3">
                  <h2 className="font-heading font-semibold">{name}</h2>
                  {checks && (
                    <span
                      className={
                        partsTotal === set.rate
                          ? "text-xs text-green-700 dark:text-green-400"
                          : "text-xs font-medium text-destructive"
                      }
                    >
                      {partsTotal === set.rate
                        ? `Titles add up to the set, ${formatINR(set.rate)}`
                        : `Titles add up to ${formatINR(partsTotal)}, the set is ${formatINR(set.rate)}`}
                    </span>
                  )}
                </div>
                <div className="hidden grid-cols-[1fr_4rem_6rem_6rem_4rem_2.5rem] gap-x-3 px-4 pt-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground sm:grid">
                  <span>Item</span>
                  <span>Unit</span>
                  <span className="text-right">MRP</span>
                  <span className="text-right">Rate</span>
                  <span className="text-right">GST</span>
                  <span />
                </div>
                <ul className="divide-y">
                  {rows.map((r) => (
                    <PriceLine
                      key={r.id}
                      row={{
                        id: r.id,
                        group: r.group,
                        description: r.description,
                        hsnCode: r.hsnCode,
                        unit: r.unit,
                        mrp: r.mrp,
                        rate: r.rate,
                        gstRate: r.gstRate,
                        isActive: r.isActive,
                      }}
                      canEdit={canEdit}
                      groups={names}
                    />
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
