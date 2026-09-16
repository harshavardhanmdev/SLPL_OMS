export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { db } from "@/lib/db";
import { getStaff, roleCan } from "@/lib/staff-auth";

export const metadata: Metadata = { title: "Audit trail", robots: { index: false } };

const stamp = (d: Date) =>
  d.toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

export default async function AuditPage({
  searchParams,
}: {
  searchParams: Promise<{ entity?: string }>;
}) {
  const me = await getStaff();
  if (!me || !roleCan(me.role, "staff.manage")) redirect("/erp");
  const { entity } = await searchParams;

  const entries = await db.adminAuditLog.findMany({
    where: entity ? { entityType: entity } : {},
    orderBy: { createdAt: "desc" },
    take: 300,
  });

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <div>
        <h1 className="font-heading text-2xl font-bold">Audit trail</h1>
        <p className="text-sm text-muted-foreground">
          Who did what, and when. Nothing here can be edited or removed from the panel.
        </p>
      </div>

      <div className="rounded-2xl border bg-card">
        {entries.length === 0 ? (
          <p className="p-10 text-center text-sm text-muted-foreground">Nothing recorded yet.</p>
        ) : (
          <ul className="divide-y">
            {entries.map((e) => (
              <li key={e.id} className="flex flex-wrap items-baseline justify-between gap-2 p-3 text-sm">
                <span className="min-w-0">
                  <b className="font-mono text-xs">{e.action}</b>
                  <span className="ml-2 text-muted-foreground">
                    {e.actorEmail}
                    {e.entityType ? ` · ${e.entityType}` : ""}
                    {e.ip ? ` · ${e.ip}` : ""}
                  </span>
                </span>
                <span className="shrink-0 text-xs text-muted-foreground">{stamp(e.createdAt)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
