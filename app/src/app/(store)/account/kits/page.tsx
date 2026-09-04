export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Backpack } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { KIT_STATUS_META } from "@/lib/kits";
import { formatINR } from "@/lib/money";

export const metadata: Metadata = { title: "My kits" };

const badgeTone: Record<string, string> = {
  amber: "bg-saffron/20 text-saffron-deep border-saffron/40",
  blue: "bg-navy/10 text-navy border-navy/30 dark:text-foreground",
  green: "bg-green-100 text-green-800 border-green-300 dark:bg-green-950 dark:text-green-200",
  grey: "bg-muted text-muted-foreground border-border",
};

export default async function MyKitsPage() {
  const session = await getSession();
  if (!session) redirect("/login?next=/account/kits");

  const purchases = await db.kitPurchase.findMany({
    where: { order: { userId: session.uid } },
    include: { schoolKit: { select: { academicYear: true } } },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <h1 className="mb-1 font-heading text-2xl font-bold">My kits</h1>
      <p className="mb-6 text-sm text-muted-foreground">
        Every school kit you have paid for. Open a receipt to show its QR code at the school.
      </p>

      {purchases.length === 0 ? (
        <div className="rounded-2xl border bg-card p-8 text-center">
          <Backpack className="mx-auto size-8 text-muted-foreground" />
          <p className="mt-3 font-medium">No kits yet.</p>
          <p className="mt-1 text-sm text-muted-foreground">
            If your school offers kits through us, you can pay for one here.
          </p>
          <Button className="mt-4" asChild>
            <Link href="/kits">Browse school kits</Link>
          </Button>
        </div>
      ) : (
        <ul className="space-y-3">
          {purchases.map((p) => {
            const meta = KIT_STATUS_META[p.status] ?? { label: p.status, tone: "grey" as const };
            return (
              <li key={p.id}>
                <Link
                  href={`/kits/receipt/${p.accessToken}`}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border bg-card p-5 transition hover:border-saffron"
                >
                  <div className="min-w-0">
                    <p className="font-heading font-semibold">{p.studentName}</p>
                    <p className="text-sm text-muted-foreground">
                      {p.classLabel} {p.section} · {p.schoolName} · {p.schoolKit.academicYear}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Receipt {p.receiptNumber} · {formatINR(p.amountPaid)}
                    </p>
                  </div>
                  <Badge className={badgeTone[meta.tone]}>{meta.label}</Badge>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
