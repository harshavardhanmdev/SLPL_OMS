import "server-only";

import { randomInt } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

import { appCategoryFor, ledgerFor } from "@/lib/claims";
import { db } from "@/lib/db";

/**
 * Two-way sync with the Team Expenses app (expenses.theslpl.in), the phone app
 * the team records trip bills in. The back office joins that app's sync just
 * as one more phone would, through the same API with the same key, so neither
 * the app nor its server needs to change.
 *
 *  - A bill in the app from someone linked here (AdminUser.expensesAppName)
 *    becomes their expense claim, and its status follows the app.
 *  - A claim made or decided here goes to the app. Website claims sit in a trip
 *    of their own there, "Office expenses (website)".
 *  - Either side can approve; the newest change wins, as between phones.
 *  - Photos stay where they were taken: app photos are shown here through
 *    /api/team-expenses/receipts, website photos are sent to the app as JPEG.
 *
 * Run by the worker every 30 seconds. Off unless TEAM_EXPENSES_URL and
 * TEAM_EXPENSES_KEY are set.
 */

const BASE = process.env.TEAM_EXPENSES_URL?.replace(/\/+$/, "");
const KEY = process.env.TEAM_EXPENSES_KEY;
const UPLOADS_DIR = process.env.UPLOADS_DIR ?? path.join(process.cwd(), "uploads");
const SAFE_ID = /^[A-Za-z0-9-]{1,64}$/;
const STATUSES = ["PENDING", "APPROVED", "REJECTED", "PAID"] as const;
const OFFICE_TRIP_NAME = "Office expenses (website)";

export const teamExpensesEnabled = () => Boolean(BASE && KEY);

/** Where an app bill's photo is shown here. */
export const appReceiptUrl = (id: string) => `/api/team-expenses/receipts/${id}`;

type AppRecord = {
  kind: string;
  id: string;
  data: Record<string, unknown>;
  updatedAt: number;
  deleted: boolean;
};
type Team = { employees: string[]; managerName: string };
type OfficeTrip = { pin: string; assigned: string[]; createdAt: number };

async function call(method: string, pathname: string, body?: BodyInit, type?: string): Promise<Response> {
  const res = await fetch(`${BASE}${pathname}`, {
    method,
    body,
    headers: { "X-Api-Key": KEY!, ...(type ? { "Content-Type": type } : {}) },
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) throw new Error(`Team Expenses ${method} ${pathname}: ${res.status}`);
  return res;
}

/** An app bill's photo, or null when the app has none. */
export async function fetchAppReceipt(id: string): Promise<ArrayBuffer | null> {
  if (!teamExpensesEnabled() || !SAFE_ID.test(id)) return null;
  try {
    return await (await call("GET", `/api/receipts/${id}`)).arrayBuffer();
  } catch {
    return null;
  }
}

async function getSetting<T>(key: string, fallback: T): Promise<T> {
  const row = await db.setting.findUnique({ where: { key } });
  return row ? (row.value as T) : fallback;
}

async function putSetting(key: string, value: unknown) {
  await db.setting.upsert({
    where: { key },
    create: { key, value: value as never },
    update: { value: value as never },
  });
}

/** The app matches names loosely too: "K Harish Goud" is "k harish goud". */
const squash = (s: string) => s.toLowerCase().replace(/[^a-z]/g, "");

/** UTC midnight of the bill's day, which is how the app stores a date. */
const dayMs = (d: Date) => Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());

type Linked = { id: string; expensesAppName: string };

async function linkedStaff(): Promise<Linked[]> {
  const rows = await db.adminUser.findMany({
    where: { isActive: true, expensesAppName: { not: null } },
    select: { id: true, expensesAppName: true },
  });
  return rows.map((r) => ({ id: r.id, expensesAppName: r.expensesAppName! }));
}

/** One bill from the app, written onto its claim here. True when anything changed. */
async function applyExpense(r: AppRecord, people: Map<string, Linked>, team: Team, trips: Record<string, string>) {
  if (!SAFE_ID.test(r.id)) return false;
  // A website claim goes to the app under its own id; found that way too if
  // the round that sent it stopped before noting it
  const existing =
    (await db.expenseClaim.findUnique({ where: { externalId: r.id } })) ??
    (await db.expenseClaim.findUnique({ where: { id: r.id } }));
  // Changed here since the last sync: ours goes out in a moment and is newer
  if (existing?.syncPending) return false;

  if (r.deleted) {
    if (!existing) return false;
    await db.expenseClaim.delete({ where: { id: existing.id } });
    return true;
  }
  if (existing?.appUpdatedAt != null && existing.appUpdatedAt >= BigInt(r.updatedAt)) return false;

  const d = r.data;
  const person = people.get(squash(String(d.employeeName ?? "")));
  // Only people linked to a login here; anyone else's bills stay in the app
  if (!person) return false;

  const status = (STATUSES as readonly string[]).includes(String(d.status)) ? (String(d.status) as (typeof STATUSES)[number]) : "PENDING";
  const decided = status !== "PENDING";
  const sameDecision = existing?.status === status;
  const appCategory = String(d.category || "OTHER");
  const title = String(d.title ?? "").trim();
  const notes = String(d.notes ?? "").trim();
  const data = {
    claimedById: person.id,
    spentOn: new Date(Number(d.date) || r.updatedAt),
    amount: Math.round(Number(d.amount ?? 0) * 100),
    category: ledgerFor(appCategory) as never,
    appCategory,
    paymentMode: String(d.paymentMode || "") || null,
    note: [title, notes].filter(Boolean).join(" · ") || "Bill from the Team Expenses app",
    // A photo taken here stays here; one taken in the app is shown from there
    billImage: existing?.billImage?.startsWith("/media/") ? existing.billImage : d.hasReceipt ? appReceiptUrl(r.id) : null,
    status,
    decidedByName: !decided ? null : sameDecision ? existing!.decidedByName : team.managerName || "Team Expenses app",
    decidedAt: !decided ? null : sameDecision ? existing!.decidedAt : new Date(r.updatedAt),
    rejectedReason: status === "REJECTED" ? String(d.managerComment || "") || "Sent back in the Team Expenses app" : null,
    paidAt: d.paidAt ? new Date(Number(d.paidAt)) : null,
    tripName: trips[String(d.tripPin ?? "")] ?? null,
    appData: d as never,
    appUpdatedAt: BigInt(r.updatedAt),
    syncPending: false,
  };
  if (!existing) {
    await db.expenseClaim.create({ data: { ...data, externalId: r.id } });
    return true;
  }
  // Not if someone changed it here while this round ran; theirs goes out next
  const done = await db.expenseClaim.updateMany({
    where: { id: existing.id, updatedAt: existing.updatedAt },
    data: { ...data, externalId: r.id },
  });
  return done.count > 0;
}

async function pull(people: Map<string, Linked>): Promise<number> {
  // Someone newly linked has bills from before: read the app from the start.
  // Bills already here are skipped by their version, so this is safe to repeat.
  const linkedNow = [...people.keys()].sort().join("|");
  const linkedBefore = await getSetting<string | null>("team_expenses_linked", null);
  const since = linkedNow === linkedBefore ? await getSetting<number>("team_expenses_seq", 0) : 0;
  const body = (await (await call("GET", `/api/sync?since=${since}`)).json()) as { seq: number; records: AppRecord[] };
  const team = await getSetting<Team>("team_expenses_team", { employees: [], managerName: "" });
  const trips = await getSetting<Record<string, string>>("team_expenses_trips", {});

  // The team and the trips first, so a bill in the same batch finds its trip
  for (const r of body.records) {
    if (r.kind === "settings" && !r.deleted) {
      if (Array.isArray(r.data.employees)) team.employees = r.data.employees.map(String);
      if (typeof r.data.managerName === "string") team.managerName = r.data.managerName;
    }
    if (r.kind === "trip") {
      if (r.deleted) delete trips[r.id];
      else trips[r.id] = String(r.data.name ?? "");
      // The manager removed the website trip: the next claim starts a new one
      const office = await getSetting<OfficeTrip | null>("team_expenses_office_trip", null);
      if (r.deleted && office?.pin === r.id) await db.setting.deleteMany({ where: { key: "team_expenses_office_trip" } });
    }
  }
  await putSetting("team_expenses_team", team);
  await putSetting("team_expenses_trips", trips);

  let changed = 0;
  for (const r of body.records) {
    if (r.kind === "expense" && (await applyExpense(r, people, team, trips))) changed++;
  }
  await putSetting("team_expenses_seq", body.seq);
  await putSetting("team_expenses_linked", linkedNow);
  return changed;
}

async function push(linked: Linked[]): Promise<number> {
  const now = Date.now();
  const records: AppRecord[] = [];

  // Website claims live in a trip of their own, visible to everyone linked
  const names = linked.map((l) => l.expensesAppName).sort();
  let office = await getSetting<OfficeTrip | null>("team_expenses_office_trip", null);
  let officeChanged = false;
  // Never with nobody linked: a trip with no names shows on every phone
  if (names.length > 0 && (!office || JSON.stringify(office.assigned) !== JSON.stringify(names))) {
    office = { pin: office?.pin ?? String(randomInt(100000, 1000000)), assigned: names, createdAt: office?.createdAt ?? now };
    officeChanged = true;
    records.push({
      kind: "trip",
      id: office.pin,
      updatedAt: now,
      deleted: false,
      data: {
        pin: office.pin,
        name: OFFICE_TRIP_NAME,
        location: "Claimed on the back office",
        assigned: names,
        createdAt: office.createdAt,
        closed: false,
        updatedAt: now,
      },
    });
  }

  const pending = await db.expenseClaim.findMany({
    where: { syncPending: true },
    include: { claimedBy: { select: { expensesAppName: true, isActive: true } } },
  });
  const sent: { id: string; updatedAt: Date; externalId: string; data: Record<string, unknown> }[] = [];
  for (const c of pending) {
    const name = c.claimedBy.isActive ? c.claimedBy.expensesAppName : null;
    if (!name) {
      // Not linked to the app: nothing to send, so it stops waiting
      await db.expenseClaim.updateMany({ where: { id: c.id, updatedAt: c.updatedAt }, data: { syncPending: false } });
      continue;
    }
    const base = (c.appData ?? {}) as Record<string, unknown>;
    const id = c.externalId ?? c.id;
    try {
      // The photo first, as a phone does, so the bill never arrives without it
      const localPhoto = c.billImage?.startsWith("/media/receipt-") ? c.billImage : null;
      if (localPhoto && !base.hasReceipt) {
        const file = await readFile(path.join(UPLOADS_DIR, path.basename(localPhoto)));
        const jpeg = await sharp(file).rotate().jpeg({ quality: 82 }).toBuffer();
        await call("PUT", `/api/receipts/${id}`, new Uint8Array(jpeg), "image/jpeg");
      }
      const data: Record<string, unknown> = {
        ...base,
        id,
        tripPin: base.tripPin ?? office!.pin,
        title: typeof base.title === "string" ? base.title : c.note,
        amount: c.amount / 100,
        category: c.appCategory ?? appCategoryFor(c.category),
        paymentMode: c.paymentMode ?? base.paymentMode ?? "OTHER",
        date: dayMs(c.spentOn),
        notes: base.notes ?? "",
        employeeName: name,
        status: c.status,
        managerComment: c.status === "REJECTED" ? (c.rejectedReason ?? "") : (base.managerComment ?? ""),
        hasReceipt: Boolean(localPhoto) || Boolean(base.hasReceipt),
        createdAt: base.createdAt ?? c.createdAt.getTime(),
        updatedAt: now,
        sentAt: null,
        paidAt: c.paidAt?.getTime() ?? base.paidAt ?? null,
      };
      records.push({ kind: "expense", id, data, updatedAt: now, deleted: false });
      sent.push({ id: c.id, updatedAt: c.updatedAt, externalId: id, data });
    } catch (err) {
      // Left waiting, so the next round tries again
      console.error("[team-expenses] could not send claim", c.id, err);
    }
  }

  const gone = await db.teamExpenseDeletion.findMany();
  for (const g of gone) records.push({ kind: "expense", id: g.externalId, data: {}, updatedAt: now, deleted: true });

  if (records.length === 0) return 0;
  await call("POST", "/api/push", JSON.stringify({ records }), "application/json");

  if (officeChanged) await putSetting("team_expenses_office_trip", office);
  for (const s of sent) {
    // Skipped if someone changed the claim while it was being sent; it goes next round
    await db.expenseClaim.updateMany({
      where: { id: s.id, updatedAt: s.updatedAt },
      data: { externalId: s.externalId, appData: s.data as never, appUpdatedAt: BigInt(now), syncPending: false },
    });
  }
  if (gone.length) await db.teamExpenseDeletion.deleteMany({ where: { externalId: { in: gone.map((g) => g.externalId) } } });
  return sent.length + gone.length;
}

let running = false;

/** One round: take the app's changes, then send ours. */
export async function syncTeamExpenses(): Promise<{ pulled: number; pushed: number } | null> {
  if (!teamExpensesEnabled() || running) return null;
  running = true;
  try {
    const linked = await linkedStaff();
    const people = new Map(linked.map((l) => [squash(l.expensesAppName), l]));
    const pulled = await pull(people);
    const pushed = await push(linked);
    return { pulled, pushed };
  } finally {
    running = false;
  }
}

/** The names in the app's team list, for linking a login on the Staff screen. */
export async function appEmployees(): Promise<string[]> {
  return (await getSetting<Team>("team_expenses_team", { employees: [], managerName: "" })).employees;
}
