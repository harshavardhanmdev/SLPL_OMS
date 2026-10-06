/**
 * Creates the sales team: a manager who raises quotations and an executive
 * reporting to him.
 *
 * Passwords come from the environment, never from this file, because the repo
 * is public. Idempotent, so re-running it only resets what is passed in.
 *
 *   SLPL_PW_UDAY=... SLPL_PW_HARISH=... \
 *   NODE_OPTIONS=--conditions=react-server npx tsx scripts/seed-sales-team.ts
 */
import "dotenv/config";

import bcrypt from "bcryptjs";

import { db } from "../src/lib/db";

type Person = { email: string; name: string; role: "SALES_MANAGER" | "SALES"; env: string };

const MANAGER: Person = {
  email: "uday.kiran@theslpl.in",
  name: "Uday Kiran",
  role: "SALES_MANAGER" as const,
  env: "SLPL_PW_UDAY",
};
const EXECUTIVE: Person = {
  email: "harish.goud@theslpl.in",
  name: "Harish Goud",
  role: "SALES" as const,
  env: "SLPL_PW_HARISH",
};

async function upsert(person: Person, reportsToId: string | null) {
  const password = process.env[person.env];
  const existing = await db.adminUser.findUnique({ where: { email: person.email } });

  if (!existing && !password) {
    throw new Error(`${person.env} must be set to create ${person.email}`);
  }

  const row = await db.adminUser.upsert({
    where: { email: person.email },
    update: {
      name: person.name,
      role: person.role,
      reportsToId,
      isActive: true,
      ...(password ? { passwordHash: bcrypt.hashSync(password, 10) } : {}),
    },
    create: {
      email: person.email,
      name: person.name,
      role: person.role,
      reportsToId,
      passwordHash: bcrypt.hashSync(password!, 10),
    },
  });

  // A reset password ends every session they already had open
  if (password) {
    await db.adminSession.updateMany({
      where: { adminUserId: row.id, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }
  return row;
}

async function main() {
  const manager = await upsert(MANAGER, null);
  console.log(`${manager.name}: ${manager.email}, ${manager.role}`);

  const executive = await upsert(EXECUTIVE, manager.id);
  console.log(`${executive.name}: ${executive.email}, ${executive.role}, reports to ${manager.name}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
