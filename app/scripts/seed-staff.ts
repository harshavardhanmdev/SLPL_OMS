/**
 * Creates or updates the staff logins for the back office.
 *
 * Passwords come from the environment so they are never committed. On the
 * server, put them in deploy/.env; locally, export them for one run:
 *
 *   SLPL_PW_OWNER=... SLPL_PW_SALES=... SLPL_PW_WAREHOUSE=... \
 *   SLPL_PW_ACCOUNTS=... SLPL_PW_CA=... \
 *   NODE_OPTIONS=--conditions=react-server npx tsx scripts/seed-staff.ts
 *
 * Accounts with no password set in the environment are skipped, so a partial
 * run never leaves someone with a blank or guessable password.
 */
import "dotenv/config";
import bcrypt from "bcryptjs";

import { db } from "../src/lib/db";

const people = [
  { env: "SLPL_PW_OWNER", email: "slexams.slpl@gmail.com", name: "Owner", role: "OWNER" },
  { env: "SLPL_PW_SALES", email: "sales.demo@theslpl.in", name: "Sales", role: "SALES" },
  {
    env: "SLPL_PW_WAREHOUSE",
    email: "warehouse.demo@theslpl.in",
    name: "Warehouse",
    role: "WAREHOUSE",
  },
  { env: "SLPL_PW_ACCOUNTS", email: "accounts.demo@theslpl.in", name: "Accounts", role: "ACCOUNTS" },
  { env: "SLPL_PW_CA", email: "ca.demo@theslpl.in", name: "CA", role: "CA_READONLY" },
];

async function main() {
  let done = 0;
  for (const p of people) {
    const password = process.env[p.env];
    if (!password) {
      console.log(`${p.role.padEnd(12)} skipped, ${p.env} not set`);
      continue;
    }
    if (password.length < 8) {
      console.log(`${p.role.padEnd(12)} skipped, ${p.env} is shorter than 8 characters`);
      continue;
    }
    const passwordHash = bcrypt.hashSync(password, 10);
    const row = await db.adminUser.upsert({
      where: { email: p.email },
      update: { passwordHash, role: p.role as never, isActive: true, mustChangePassword: false },
      create: {
        email: p.email,
        name: p.name,
        passwordHash,
        role: p.role as never,
        isActive: true,
      },
    });
    // A changed password ends every session that account had open
    await db.adminSession.updateMany({
      where: { adminUserId: row.id, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    console.log(
      `${p.role.padEnd(12)} ${p.email.padEnd(28)} verified=${bcrypt.compareSync(password, row.passwordHash)}`,
    );
    done += 1;
  }
  console.log(`${done} of ${people.length} accounts set`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
