import "server-only";

import { db } from "@/lib/db";

/**
 * A customer's code, the owner's rule: three letters of the name, three of the
 * city, and the month and year they were added (GLOWAR1026). A clash takes a
 * letter, GLOWAR1026B. Schools and store customers share the one set of codes,
 * so a code printed on a label or a bill names exactly one customer.
 */
export async function allocateCustomerCode(
  name: string,
  city?: string | null,
  added?: Date,
): Promise<string> {
  const letters = (s: string) => s.toUpperCase().replace(/[^A-Z]/g, "");
  const now = added ?? new Date();
  const month = `${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getFullYear()).slice(2)}`;
  const stem = `${(letters(name).slice(0, 3) || "ORG").padEnd(3, "X")}${letters(city ?? "").slice(0, 3)}${month}`;
  for (const extra of ["", ..."BCDEFGHJKLMNPQRSTUVWXYZ"]) {
    const candidate = stem + extra;
    const [school, customer] = await Promise.all([
      db.organization.findFirst({ where: { code: candidate }, select: { id: true } }),
      db.user.findFirst({ where: { customerCode: candidate }, select: { id: true } }),
    ]);
    if (!school && !customer) return candidate;
  }
  throw new Error("Could not allocate a customer code - set one by hand.");
}
