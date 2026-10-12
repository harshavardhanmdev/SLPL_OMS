/**
 * One round of the Team Expenses sync, by hand. The worker runs it every 30
 * seconds; this is for checking it, or after setting the key.
 *
 *   NODE_OPTIONS=--conditions=react-server npx tsx scripts/sync-team-expenses.ts
 */
import "dotenv/config";

import { db } from "../src/lib/db";
import { syncTeamExpenses, teamExpensesEnabled } from "../src/lib/team-expenses";

async function main() {
  if (!teamExpensesEnabled()) throw new Error("Set TEAM_EXPENSES_URL and TEAM_EXPENSES_KEY first.");
  const done = await syncTeamExpenses();
  console.log(JSON.stringify(done));
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
