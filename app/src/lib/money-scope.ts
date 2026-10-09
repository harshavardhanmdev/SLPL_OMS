import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { roleCan, type StaffSession } from "@/lib/staff-auth";

/**
 * Whose bills a person may see. Anyone who reads the books (owners, the
 * manager, accounts, the CA) sees every one. A salesperson sees the bills of
 * the schools they look after and the bills they raised; a sales manager adds
 * the people who report to them. Null means everything.
 */
export async function salesTeam(staff: StaffSession): Promise<string[] | null> {
  if (roleCan(staff.role, "finance.read")) return null;
  const reports = await db.adminUser.findMany({
    where: { reportsToId: staff.id },
    select: { id: true },
  });
  return [staff.id, ...reports.map((r) => r.id)];
}

export function invoiceWhere(team: string[] | null): Prisma.InvoiceWhereInput {
  if (!team) return {};
  return { OR: [{ createdById: { in: team } }, { organization: { ownerId: { in: team } } }] };
}

/** Returns and payments belong to a school, so they follow whoever looks after it. */
export function schoolMoneyWhere(team: string[] | null) {
  return team ? { organization: { ownerId: { in: team } } } : {};
}

export const ownsSchool = (team: string[] | null, ownerId: string | null) =>
  !team || (ownerId !== null && team.includes(ownerId));

/**
 * People billed directly (a student's SOP, one reader's magazine) are customers
 * but not schools: they stay out of school lists, pickers and targets, and
 * sales never see them.
 */
export const SCHOOLS_ONLY = { kind: { not: "INDIVIDUAL" as const } };
