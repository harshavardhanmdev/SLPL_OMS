export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, LifeBuoy } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { categoryLabel, grievanceStatusMeta, toneClass } from "@/lib/grievances";

export const metadata: Metadata = { title: "My complaints" };

export default async function MyGrievancesPage() {
  const session = await getSession();
  if (!session) redirect("/login?next=/account/grievances");

  const grievances = await db.grievance.findMany({
    where: { userId: session.uid },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      ticketNumber: true,
      accessToken: true,
      subject: true,
      category: true,
      status: true,
      createdAt: true,
    },
  });

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/account" aria-label="Back to account">
              <ArrowLeft className="size-5" />
            </Link>
          </Button>
          <h1 className="font-heading text-2xl font-bold">My complaints</h1>
        </div>
        <Button size="sm" className="gap-2" asChild>
          <Link href="/grievance">
            <LifeBuoy className="size-4" /> Raise a complaint
          </Link>
        </Button>
      </div>

      {grievances.length === 0 ? (
        <p className="rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground">
          You have not raised any complaints. If something has gone wrong with an order or a payment,{" "}
          <Link href="/grievance" className="underline underline-offset-2">
            tell us here
          </Link>
          .
        </p>
      ) : (
        <ul className="divide-y rounded-2xl border bg-card">
          {grievances.map((g) => {
            const meta = grievanceStatusMeta[g.status] ?? { label: g.status, tone: "info" as const };
            return (
              <li key={g.id}>
                <Link
                  href={`/grievance/track/${g.accessToken}`}
                  className="flex flex-wrap items-center justify-between gap-3 p-4 transition-colors hover:bg-secondary/50"
                >
                  <span className="min-w-0">
                    <span className="block font-medium">{g.subject}</span>
                    <span className="text-sm text-muted-foreground">
                      {g.ticketNumber} · {categoryLabel(g.category)} ·{" "}
                      {g.createdAt.toLocaleDateString("en-IN", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </span>
                  </span>
                  <Badge className={toneClass(meta.tone)}>{meta.label}</Badge>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
