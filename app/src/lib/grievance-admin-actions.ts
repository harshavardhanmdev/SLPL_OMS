"use server";

import { z } from "zod";

import { isAdmin } from "@/lib/admin-auth";
import { db } from "@/lib/db";

type Result = { ok?: boolean; error?: string };

async function ensureAdmin(): Promise<string | null> {
  return (await isAdmin()) ? null : "UNAUTHORIZED";
}

async function findGrievance(ticketNumber: string) {
  return db.grievance.findUnique({ where: { ticketNumber } });
}

const noteSchema = z.string().trim().min(3, "Please add a short note").max(2000);

/**
 * Moves a grievance to a new status, writes the timeline entry and tells the
 * customer. `customerBody` is what they read in the email; pass null for
 * internal-only transitions.
 */
async function transition(
  ticketNumber: string,
  next: "ACKNOWLEDGED" | "IN_PROGRESS" | "AWAITING_CUSTOMER" | "RESOLVED" | "CLOSED" | "ESCALATED",
  opts: { note: string; headline: string | null; customerBody: string | null; resolution?: string },
): Promise<Result> {
  const denied = await ensureAdmin();
  if (denied) return { error: denied };

  const g = await findGrievance(ticketNumber);
  if (!g) return { error: "Complaint not found." };
  if (["CLOSED"].includes(g.status)) return { error: "This complaint is already closed." };

  const now = new Date();
  const updated = await db.grievance.update({
    where: { id: g.id },
    data: {
      status: next,
      ...(next === "ACKNOWLEDGED" && !g.acknowledgedAt ? { acknowledgedAt: now } : {}),
      ...(next === "RESOLVED" ? { resolvedAt: now, resolution: opts.resolution ?? opts.note } : {}),
    },
  });
  await db.grievanceEvent.create({
    data: {
      grievanceId: g.id,
      status: next,
      note: opts.note,
      byAdmin: true,
      visibleToCustomer: opts.customerBody !== null,
    },
  });

  if (opts.headline && opts.customerBody) {
    const { emailGrievanceUpdate } = await import("@/lib/grievance-notify");
    const { getGrievanceOfficer } = await import("@/lib/grievances");
    await emailGrievanceUpdate(updated, opts.headline, opts.customerBody, await getGrievanceOfficer());
  }
  return { ok: true };
}

export async function grievanceAcknowledge(ticketNumber: string): Promise<Result> {
  return transition(ticketNumber, "ACKNOWLEDGED", {
    note: "Acknowledged by the grievance team",
    headline: "We have your complaint",
    customerBody:
      "Our team has read your complaint and it is now with the grievance officer. We will come back to you with an outcome as quickly as we can.",
  });
}

export async function grievanceStartWork(ticketNumber: string): Promise<Result> {
  return transition(ticketNumber, "IN_PROGRESS", {
    note: "Investigation started",
    headline: "We are looking into it",
    customerBody:
      "We are investigating your complaint now. If we need anything from you we will write to you on this ticket.",
  });
}

export async function grievanceAwaitCustomer(ticketNumber: string, question: string): Promise<Result> {
  const parsed = noteSchema.safeParse(question);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  return transition(ticketNumber, "AWAITING_CUSTOMER", {
    note: parsed.data,
    headline: "We need a little more information",
    customerBody: `${parsed.data}<br><br>Please reply on your complaint page and we will pick it straight back up.`,
  });
}

export async function grievanceResolve(ticketNumber: string, resolution: string): Promise<Result> {
  const parsed = noteSchema.safeParse(resolution);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  return transition(ticketNumber, "RESOLVED", {
    note: parsed.data,
    resolution: parsed.data,
    headline: "Your complaint is resolved",
    customerBody: `${parsed.data}<br><br>If this does not fully settle the matter, reply on your complaint page within 15 days and we will reopen it.`,
  });
}

export async function grievanceEscalate(ticketNumber: string, note: string): Promise<Result> {
  const parsed = noteSchema.safeParse(note);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  return transition(ticketNumber, "ESCALATED", {
    note: parsed.data,
    headline: "Your complaint has been escalated",
    customerBody:
      "Your complaint has been escalated internally for a closer look. We will update you as soon as there is an outcome.",
  });
}

export async function grievanceClose(ticketNumber: string): Promise<Result> {
  return transition(ticketNumber, "CLOSED", {
    note: "Closed by the grievance team",
    headline: null,
    customerBody: null,
  });
}

/** Internal note: never emailed, never shown to the customer. */
export async function grievanceAddNote(ticketNumber: string, note: string): Promise<Result> {
  const denied = await ensureAdmin();
  if (denied) return { error: denied };
  const parsed = noteSchema.safeParse(note);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const g = await findGrievance(ticketNumber);
  if (!g) return { error: "Complaint not found." };

  await db.grievanceEvent.create({
    data: {
      grievanceId: g.id,
      status: "NOTE",
      note: parsed.data,
      byAdmin: true,
      visibleToCustomer: false,
    },
  });
  return { ok: true };
}
