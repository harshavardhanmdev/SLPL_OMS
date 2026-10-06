export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Download, Gift } from "lucide-react";

import { Button } from "@/components/ui/button";
import { GiftLogger } from "@/components/erp/simple-logger";
import { db } from "@/lib/db";
import { formatINR } from "@/lib/money";
import { getStaff, roleCan } from "@/lib/staff-auth";

export const metadata: Metadata = { title: "Gifts", robots: { index: false } };

const dateIN = (d: Date) =>
  d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });

export default async function GiftsPage() {
  const staff = await getStaff();
  if (!staff || !roleCan(staff.role, "crm.read")) redirect("/erp");
  const canWrite = roleCan(staff.role, "crm.write");

  const [gifts, organizations] = await Promise.all([
    db.gift.findMany({
      orderBy: { givenOn: "desc" },
      take: 200,
      include: {
        organization: { select: { id: true, name: true } },
        givenBy: { select: { name: true } },
      },
    }),
    db.organization.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);

  const spent = gifts.reduce((s, g) => s + (g.value ?? 0), 0);

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-heading text-2xl font-bold">Gifts</h1>
          <p className="text-sm text-muted-foreground">
            What has gone to which school, and what it cost us.
          </p>
        </div>
        <Button variant="outline" className="gap-2" asChild>
          <Link href="/erp/export/gifts">
            <Download className="size-4" /> Excel
          </Link>
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {[
          ["Gifts given", String(gifts.length), "all time"],
          ["Spent", formatINR(spent), "where a value was recorded"],
          [
            "Schools",
            String(new Set(gifts.map((g) => g.organization.id)).size),
            "have received something",
          ],
        ].map(([head, value, hint]) => (
          <div key={head} className="rounded-2xl border bg-card p-4">
            <p className="text-xs text-muted-foreground">{head}</p>
            <p className="font-heading text-xl font-bold">{value}</p>
            <p className="text-xs text-muted-foreground">{hint}</p>
          </div>
        ))}
      </div>

      {canWrite &&
        (organizations.length > 0 ? (
          <GiftLogger organizations={organizations} />
        ) : (
          <p className="rounded-2xl border border-dashed bg-card p-4 text-sm text-muted-foreground">
            A gift is recorded against a school, and there are none on record yet.{" "}
            <Link href="/erp/organizations/new" className="font-medium text-foreground underline">
              Add the school
            </Link>{" "}
            first.
          </p>
        ))}

      {gifts.length === 0 ? (
        <div className="rounded-2xl border bg-card p-10 text-center">
          <Gift className="mx-auto size-8 text-muted-foreground" />
          <p className="mt-3 font-medium">Nothing recorded yet.</p>
        </div>
      ) : (
        <ul className="divide-y rounded-2xl border bg-card">
          {gifts.map((g) => (
            <li key={g.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
              <div className="min-w-0">
                <p className="font-medium">{g.description}</p>
                <p className="text-sm text-muted-foreground">
                  <Link href={`/erp/organizations/${g.organization.id}`} className="hover:underline">
                    {g.organization.name}
                  </Link>
                  {g.givenToName ? ` · to ${g.givenToName}` : ""}
                  {g.givenBy ? ` · ${g.givenBy.name}` : ""} · {dateIN(g.givenOn)}
                </p>
              </div>
              {g.value != null && <span className="font-medium">{formatINR(g.value)}</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
