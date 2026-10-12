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

/**
 * Each school's next follow-up: the next action on its latest visit, call or
 * note. An older visit's next action was overtaken by the one after it, so it
 * no longer counts. Lost schools, and a latest visit that won the order, have
 * none. Soonest first; with a person, only the schools whose latest entry is theirs.
 */
export async function followUps(byId: string | null) {
  const latest = await db.visit.findMany({
    where: { organization: { status: { not: "LOST" } } },
    distinct: ["organizationId"],
    orderBy: [{ organizationId: "asc" }, { visitedOn: "desc" }, { createdAt: "desc" }],
    include: { organization: { select: { id: true, name: true } } },
  });
  return latest
    .filter((v) => !v.converted && (!byId || v.byId === byId))
    .sort((a, b) => a.nextActionOn.getTime() - b.nextActionOn.getTime());
}
