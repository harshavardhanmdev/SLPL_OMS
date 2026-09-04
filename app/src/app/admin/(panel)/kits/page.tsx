export const dynamic = "force-dynamic";

import Link from "next/link";
import { Backpack, School as SchoolIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { KitPurchaseActions } from "@/components/admin/kit-purchase-actions";
import { db } from "@/lib/db";
import { KIT_STATUS_META, currentAcademicYear } from "@/lib/kits";
import { formatINR } from "@/lib/money";

const badgeTone: Record<string, string> = {
  amber: "bg-saffron/20 text-saffron-deep border-saffron/40",
  blue: "bg-navy/10 text-navy border-navy/30 dark:text-foreground",
  green: "bg-green-100 text-green-800 border-green-300 dark:bg-green-950 dark:text-green-200",
  grey: "bg-muted text-muted-foreground border-border",
};

const dateIN = (d: Date) =>
  d.toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });

/** The board: what has been paid for, what is waiting, what has gone out. */
export default async function AdminKitsPage({
  searchParams,
}: {
  searchParams: Promise<{ school?: string }>;
}) {
  const { school: schoolFilter } = await searchParams;
  const year = currentAcademicYear();

  const [schools, purchases] = await Promise.all([
    db.school.findMany({
      orderBy: { name: "asc" },
      select: {
        id: true,
        code: true,
        name: true,
        city: true,
        isActive: true,
        _count: { select: { students: true, kits: true } },
      },
    }),
    db.kitPurchase.findMany({
      where: {
        status: { not: "CANCELLED" },
        schoolKit: {
          academicYear: year,
          ...(schoolFilter ? { school: { code: schoolFilter.toUpperCase() } } : {}),
        },
      },
      include: { schoolKit: { select: { school: { select: { code: true, name: true } } } } },
      orderBy: { createdAt: "desc" },
      take: 300,
    }),
  ]);

  const stages = ["PENDING", "PAID", "READY", "COLLECTED"] as const;
  const grouped = Object.fromEntries(
    stages.map((s) => [s, purchases.filter((p) => p.status === s)]),
  ) as Record<(typeof stages)[number], typeof purchases>;

  const collected = grouped.COLLECTED.length;
  const outstanding = grouped.PAID.length + grouped.READY.length;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-heading text-2xl font-bold">School kits</h1>
          <p className="text-sm text-muted-foreground">
            Academic year {year} · {outstanding} awaiting collection · {collected} collected
          </p>
        </div>
        <Button variant="outline" className="gap-2" asChild>
          <Link href="/admin/kits/schools">
            <SchoolIcon className="size-4" /> Schools and rosters
          </Link>
        </Button>
      </div>

      {schools.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <Link
            href="/admin/kits"
            className={`rounded-full border px-3 py-1 text-sm ${schoolFilter ? "hover:bg-accent" : "bg-navy text-white"}`}
          >
            All schools
          </Link>
          {schools
            .filter((s) => s._count.kits > 0)
            .map((s) => (
              <Link
                key={s.id}
                href={`/admin/kits?school=${s.code}`}
                className={`rounded-full border px-3 py-1 text-sm ${
                  schoolFilter?.toUpperCase() === s.code ? "bg-navy text-white" : "hover:bg-accent"
                }`}
              >
                {s.name}
              </Link>
            ))}
        </div>
      )}

      {purchases.length === 0 ? (
        <div className="rounded-2xl border bg-card p-10 text-center">
          <Backpack className="mx-auto size-8 text-muted-foreground" />
          <p className="mt-3 font-medium">No kit purchases yet for {year}.</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Add a school, give it a kit for each class, then import the roster.
          </p>
          <Button className="mt-4" asChild>
            <Link href="/admin/kits/schools">Set up a school</Link>
          </Button>
        </div>
      ) : (
        <div className="grid gap-5 lg:grid-cols-2 xl:grid-cols-4">
          {stages.map((stage) => {
            const meta = KIT_STATUS_META[stage];
            const rows = grouped[stage];
            return (
              <section key={stage} className="rounded-2xl border bg-card">
                <header className="flex items-center justify-between border-b p-4">
                  <h2 className="font-heading font-semibold">{meta.label}</h2>
                  <Badge className={badgeTone[meta.tone]}>{rows.length}</Badge>
                </header>
                {rows.length === 0 ? (
                  <p className="p-4 text-sm text-muted-foreground">Nothing here.</p>
                ) : (
                  <ul className="divide-y">
                    {rows.map((p) => (
                      <li key={p.id} className="p-4 text-sm">
                        <p className="font-medium">{p.studentName}</p>
                        <p className="text-xs text-muted-foreground">
                          {p.classLabel} {p.section} · {p.schoolKit.school.name}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          <Link
                            href={`/kits/receipt/${p.accessToken}`}
                            className="hover:underline"
                            target="_blank"
                          >
                            {p.receiptNumber}
                          </Link>{" "}
                          · {formatINR(p.amountPaid)} · {dateIN(p.createdAt)}
                        </p>
                        {p.status === "COLLECTED" && p.collectedBy && (
                          <p className="mt-1 text-xs text-muted-foreground">
                            By {p.collectedBy}
                            {p.collectedAt ? ` on ${dateIN(p.collectedAt)}` : ""}
                          </p>
                        )}
                        {(p.status === "PAID" || p.status === "READY") && (
                          <KitPurchaseActions purchaseId={p.id} status={p.status} />
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
