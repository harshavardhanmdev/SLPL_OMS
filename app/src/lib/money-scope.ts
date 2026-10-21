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

/**
 * The Organisations type filter: schools (with colleges and institutions),
 * distributors, or people billed directly, which only those who see every
 * bill are offered. Anything else is everyone but those people.
 */
export const ORG_TYPES = ["schools", "distributors", "people"] as const;

export function orgTypeWhere(type: string | null | undefined, team: string[] | null) {
  if (type === "schools") return { kind: { in: ["SCHOOL" as const, "COLLEGE" as const, "INSTITUTION" as const] } };
  if (type === "distributors") return { kind: "DISTRIBUTOR" as const };
  if (type === "people" && team === null) return { kind: "INDIVIDUAL" as const };
  return SCHOOLS_ONLY;
}

/** The type a request may filter by: individuals only for those who see every bill. */
export const orgType = (type: string | null | undefined, team: string[] | null) =>
  type === "schools" || type === "distributors" || (type === "people" && team === null) ? type : "";

export const KIND_LABEL: Record<string, string> = {
  SCHOOL: "School",
  COLLEGE: "College",
  DISTRIBUTOR: "Distributor",
  INSTITUTION: "Institution",
  INDIVIDUAL: "Person",
};
