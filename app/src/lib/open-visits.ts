import "server-only";

import type { OpenVisit } from "@/components/erp/invoice-form";
import { db } from "@/lib/db";

const dateIN = (d: Date) => d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });

/** Visits that have not turned into a bill yet, newest first, for the invoice form. */
export async function openVisits(): Promise<OpenVisit[]> {
  const rows = await db.visit.findMany({
    where: { converted: false },
    orderBy: { visitedOn: "desc" },
    take: 400,
    select: {
      id: true,
      organizationId: true,
      visitedOn: true,
      kind: true,
      summary: true,
      by: { select: { name: true } },
    },
  });
  return rows.map((v) => ({
    id: v.id,
    organizationId: v.organizationId,
    label: `${dateIN(v.visitedOn)}, ${v.kind.toLowerCase().replace("_", " ")}${v.by ? ` by ${v.by.name}` : ""}: ${v.summary.slice(0, 60)}`,
  }));
}
