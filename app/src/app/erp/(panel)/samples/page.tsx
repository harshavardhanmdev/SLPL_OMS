export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Download, Package } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SampleLogger } from "@/components/erp/simple-logger";
import { db } from "@/lib/db";
import { getStaff, roleCan } from "@/lib/staff-auth";

export const metadata: Metadata = { title: "Samples", robots: { index: false } };

const tone: Record<string, string> = {
  WITH_SCHOOL: "bg-saffron/15 text-saffron-deep border-saffron/40",
  RETURNED: "bg-muted text-muted-foreground border-border",
  CONVERTED: "bg-green-100 text-green-800 border-green-300 dark:bg-green-950 dark:text-green-200",
  WRITTEN_OFF: "bg-muted text-muted-foreground border-border",
};

const label: Record<string, string> = {
  WITH_SCHOOL: "With the school",
  RETURNED: "Returned",
  CONVERTED: "Became an order",
  WRITTEN_OFF: "Written off",
};

const dateIN = (d: Date) =>
  d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });

export default async function SamplesPage() {
  const staff = await getStaff();
  if (!staff || !roleCan(staff.role, "crm.read")) redirect("/erp");
  const canWrite = roleCan(staff.role, "crm.write");

  const [samples, organizations] = await Promise.all([
    db.sampleIssue.findMany({
      orderBy: { issuedOn: "desc" },
      take: 200,
      include: {
        organization: { select: { id: true, name: true } },
        issuedBy: { select: { name: true } },
      },
    }),
    db.organization.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);

  const out = samples.filter((s) => s.status === "WITH_SCHOOL");

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-heading text-2xl font-bold">Samples</h1>
          <p className="text-sm text-muted-foreground">
            What is sitting in a staffroom somewhere, and who left it there.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" className="gap-2" asChild>
            <Link href="/erp/export/samples">
              <Download className="size-4" /> Excel
            </Link>
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          ["Out with schools", String(out.reduce((s, x) => s + x.quantity, 0)), `${out.length} drops`],
          [
            "Became orders",
            String(samples.filter((s) => s.status === "CONVERTED").length),
            "sample worked",
          ],
          [
            "Returned",
            String(samples.filter((s) => s.status === "RETURNED").length),
            "came back to us",
          ],
          ["Recorded", String(samples.length), "all time"],
        ].map(([head, value, hint]) => (
          <div key={head} className="rounded-2xl border bg-card p-4">
            <p className="text-xs text-muted-foreground">{head}</p>
            <p className="font-heading text-xl font-bold">{value}</p>
            <p className="text-xs text-muted-foreground">{hint}</p>
          </div>
        ))}
      </div>

      {canWrite && organizations.length > 0 && <SampleLogger organizations={organizations} />}

      {samples.length === 0 ? (
        <div className="rounded-2xl border bg-card p-10 text-center">
          <Package className="mx-auto size-8 text-muted-foreground" />
          <p className="mt-3 font-medium">Nothing recorded yet.</p>
        </div>
      ) : (
        <ul className="divide-y rounded-2xl border bg-card">
          {samples.map((s) => (
            <li key={s.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
              <div className="min-w-0">
                <p className="font-medium">
                  {s.quantity} x {s.description}
                </p>
                <p className="text-sm text-muted-foreground">
                  <Link href={`/erp/organizations/${s.organization.id}`} className="hover:underline">
                    {s.organization.name}
                  </Link>
                  {s.issuedBy ? ` · ${s.issuedBy.name}` : ""} · {dateIN(s.issuedOn)}
                </p>
              </div>
              <Badge className={tone[s.status]}>{label[s.status] ?? s.status}</Badge>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
