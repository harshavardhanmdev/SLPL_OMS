export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Backpack, Download, Package, School } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SampleActions, SampleTaker } from "@/components/erp/sample-board";
import { db } from "@/lib/db";
import { getStaff, roleCan } from "@/lib/staff-auth";

export const metadata: Metadata = { title: "Samples", robots: { index: false } };

const tone: Record<string, string> = {
  IN_HAND: "bg-sky-100 text-sky-800 border-sky-300 dark:bg-sky-950 dark:text-sky-200",
  WITH_SCHOOL: "bg-saffron/15 text-saffron-deep border-saffron/40",
  RETURNED: "bg-muted text-muted-foreground border-border",
  CONVERTED: "bg-green-100 text-green-800 border-green-300 dark:bg-green-950 dark:text-green-200",
  WRITTEN_OFF: "bg-muted text-muted-foreground border-border",
};

const label: Record<string, string> = {
  IN_HAND: "In hand",
  WITH_SCHOOL: "With the school",
  RETURNED: "Returned",
  CONVERTED: "Became an order",
  WRITTEN_OFF: "Written off",
};

const dateIN = (d: Date) =>
  d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });

/**
 * Specimen copies, from the office to a salesperson's bag to a school.
 *
 * A salesperson sees what they are carrying; a manager sees everyone's, which
 * is how unreturned copies get noticed before the term ends.
 */
export default async function SamplesPage() {
  const staff = await getStaff();
  if (!staff || !roleCan(staff.role, "crm.read")) redirect("/erp");
  const canWrite = roleCan(staff.role, "crm.write");
  const canManage = roleCan(staff.role, "crm.manage");
  const mine = canManage ? {} : { issuedById: staff.id };

  const [samples, organizations, holders, products] = await Promise.all([
    db.sampleIssue.findMany({
      where: mine,
      orderBy: [{ issuedOn: "desc" }, { createdAt: "desc" }],
      take: 400,
      include: {
        organization: { select: { id: true, name: true } },
        issuedBy: { select: { id: true, name: true } },
      },
    }),
    db.organization.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    canManage
      ? db.adminUser.findMany({
          where: { isActive: true, role: { in: ["SALES", "SALES_MANAGER", "OWNER", "MANAGER"] } },
          orderBy: { name: "asc" },
          select: { id: true, name: true },
        })
      : [],
    db.product.findMany({
      where: { isActive: true, kind: { not: "DIGITAL" } },
      orderBy: [{ series: "asc" }, { title: "asc" }],
      select: { title: true },
    }),
  ]);

  const inHand = samples.filter((s) => s.status === "IN_HAND");
  const atSchools = samples.filter((s) => s.status === "WITH_SCHOOL");
  const closed = samples.filter((s) => !["IN_HAND", "WITH_SCHOOL"].includes(s.status));
  const copies = (rows: typeof samples) => rows.reduce((sum, s) => sum + s.quantity, 0);

  // One heading per person, so a manager can see who is carrying what
  const byHolder = new Map<string, { name: string; rows: typeof samples }>();
  for (const s of inHand) {
    const key = s.issuedBy?.id ?? s.issuedEmail;
    const entry = byHolder.get(key) ?? { name: s.issuedBy?.name ?? s.issuedEmail, rows: [] };
    entry.rows.push(s);
    byHolder.set(key, entry);
  }

  const meId = staff.breakGlass ? null : staff.id;
  const canAct = (holderId: string | null) => canWrite && (canManage || holderId === staff.id);

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-heading text-2xl font-bold">Samples</h1>
          <p className="text-sm text-muted-foreground">
            {canManage
              ? "Every specimen copy out of the office: who is carrying it, and where it went."
              : "The specimen copies you are carrying, and where they went."}
          </p>
        </div>
        <Button variant="outline" className="gap-2" asChild>
          <Link href="/erp/export/samples">
            <Download className="size-4" /> Excel
          </Link>
        </Button>
      </div>

      <div className="erp-stagger grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          ["In hand", String(copies(inHand)), `${byHolder.size} ${byHolder.size === 1 ? "person" : "people"}`],
          [
            "With schools",
            String(copies(atSchools)),
            `${new Set(atSchools.map((s) => s.organizationId)).size} schools`,
          ],
          [
            "Became orders",
            String(samples.filter((s) => s.status === "CONVERTED").length),
            "sample worked",
          ],
          [
            "Returned",
            String(copies(samples.filter((s) => s.status === "RETURNED"))),
            "copies back at the office",
          ],
        ].map(([head, value, hint]) => (
          <div key={head} className="rounded-2xl border bg-card p-4">
            <p className="text-xs text-muted-foreground">{head}</p>
            <p className="font-heading text-2xl font-bold tabular-nums">{value}</p>
            <p className="text-xs text-muted-foreground">{hint}</p>
          </div>
        ))}
      </div>

      {canWrite && (
        <SampleTaker
          organizations={organizations}
          holders={holders}
          titles={products.map((p) => p.title)}
          meId={meId}
        />
      )}

      <section className="rounded-2xl border bg-card">
        <div className="flex items-center gap-2 border-b p-4">
          <Backpack className="size-4 text-sky-600" />
          <h2 className="font-heading font-semibold">In hand</h2>
          <span className="text-sm text-muted-foreground">
            {copies(inHand)} {copies(inHand) === 1 ? "copy" : "copies"}
          </span>
        </div>
        {inHand.length === 0 ? (
          <p className="p-6 text-center text-sm text-muted-foreground">
            Nothing is out of the office right now.
          </p>
        ) : (
          [...byHolder.values()].map((holder) => (
            <div key={holder.name}>
              {canManage && (
                <p className="bg-muted/40 px-4 py-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {holder.name}
                </p>
              )}
              <ul className="divide-y">
                {holder.rows.map((s) => (
                  <li key={s.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
                    <div className="min-w-0">
                      <p className="font-medium">
                        <span className="tabular-nums">{s.quantity}</span> x {s.description}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Taken {dateIN(s.issuedOn)}
                        {s.notes ? ` · ${s.notes}` : ""}
                      </p>
                    </div>
                    {canAct(s.issuedById) && (
                      <SampleActions
                        id={s.id}
                        status={s.status}
                        quantity={s.quantity}
                        organizations={organizations}
                      />
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))
        )}
      </section>

      <section className="rounded-2xl border bg-card">
        <div className="flex items-center gap-2 border-b p-4">
          <School className="size-4 text-saffron-deep" />
          <h2 className="font-heading font-semibold">With schools</h2>
          <span className="text-sm text-muted-foreground">
            {copies(atSchools)} {copies(atSchools) === 1 ? "copy" : "copies"}
          </span>
        </div>
        {atSchools.length === 0 ? (
          <p className="p-6 text-center text-sm text-muted-foreground">
            No copies are sitting with a school.
          </p>
        ) : (
          <ul className="divide-y">
            {atSchools.map((s) => (
              <li key={s.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
                <div className="min-w-0">
                  <p className="font-medium">
                    <span className="tabular-nums">{s.quantity}</span> x {s.description}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {s.organization && (
                      <Link
                        href={`/erp/organizations/${s.organization.id}`}
                        className="font-medium text-foreground hover:underline"
                      >
                        {s.organization.name}
                      </Link>
                    )}
                    {s.givenOn ? ` · given ${dateIN(s.givenOn)}` : ""}
                    {canManage && s.issuedBy ? ` · ${s.issuedBy.name}` : ""}
                  </p>
                </div>
                {canAct(s.issuedById) && (
                  <SampleActions
                    id={s.id}
                    status={s.status}
                    quantity={s.quantity}
                    organizations={organizations}
                  />
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      {closed.length > 0 && (
        <details className="group rounded-2xl border bg-card">
          <summary className="flex cursor-pointer list-none items-center gap-2 p-4">
            <Package className="size-4 text-muted-foreground" />
            <span className="font-heading font-semibold">Finished with</span>
            <span className="text-sm text-muted-foreground">
              {closed.length} returned, ordered or written off
            </span>
            <span className="ml-auto text-sm text-muted-foreground group-open:hidden">Show</span>
          </summary>
          <ul className="divide-y border-t">
            {closed.map((s) => (
              <li key={s.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
                <div className="min-w-0">
                  <p className="font-medium">
                    {s.quantity} x {s.description}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {s.organization ? `${s.organization.name} · ` : ""}
                    {s.issuedBy?.name ?? s.issuedEmail} · taken {dateIN(s.issuedOn)}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge className={tone[s.status]}>{label[s.status] ?? s.status}</Badge>
                  {canAct(s.issuedById) && (
                    <SampleActions
                      id={s.id}
                      status={s.status}
                      quantity={s.quantity}
                      organizations={organizations}
                    />
                  )}
                </div>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
