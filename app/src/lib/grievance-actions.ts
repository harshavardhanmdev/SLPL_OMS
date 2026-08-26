"use server";

import { headers } from "next/headers";
import { z } from "zod";

import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { rateLimit } from "@/lib/rate-limit";

const grievanceSchema = z.object({
  category: z.enum([
    "PAYMENT_DEBITED_NO_ORDER",
    "REFUND_NOT_RECEIVED",
    "DOUBLE_CHARGED",
    "ORDER_NOT_DELIVERED",
    "DAMAGED_OR_WRONG_ITEM",
    "CANCELLATION_ISSUE",
    "DATA_PRIVACY",
    "OTHER",
  ]),
  subject: z.string().trim().min(5, "Please give your complaint a short subject").max(140),
  description: z.string().trim().min(20, "Please describe what happened in a little more detail").max(4000),
  contactName: z.string().trim().min(2, "Please enter your name").max(80),
  contactEmail: z.string().trim().email("Enter a valid email address").max(160),
  contactPhone: z
    .string()
    .trim()
    .regex(/^[6-9][0-9]{9}$/, "Enter a valid 10-digit mobile number")
    .optional()
    .or(z.literal("")),
  orderRef: z.string().trim().max(40).optional().or(z.literal("")),
  paymentRef: z.string().trim().max(80).optional().or(z.literal("")),
  amountClaimed: z.string().trim().max(12).optional().or(z.literal("")),
  // Bots fill hidden fields; humans never see this one
  website: z.string().max(0).optional().or(z.literal("")),
});

/** The form holds a plain string for the select, so the input type stays loose
 *  and the zod schema does the narrowing. */
export type GrievanceInput = Omit<z.infer<typeof grievanceSchema>, "category"> & { category: string };

export async function fileGrievance(
  input: GrievanceInput,
): Promise<{ ok?: boolean; ticketNumber?: string; trackUrl?: string; error?: string }> {
  const ip = (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (!rateLimit(`grievance:${ip}`, 3, 60 * 60 * 1000)) {
    return {
      error: "Too many complaints from this connection in the last hour. Please call +91 90303 90077 if this is urgent.",
    };
  }

  const { GRIEVANCE_CATEGORIES } = await import("@/lib/grievance-constants");
  if (!GRIEVANCE_CATEGORIES.some((c) => c.value === input.category)) {
    return { error: "Please choose what went wrong" };
  }

  const parsed = grievanceSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const d = parsed.data;
  if (d.website) return { ok: true, ticketNumber: "SLPL-G-0000-00000" }; // silently drop bots

  const {
    generateTicketNumber,
    generateAccessToken,
    priorityFor,
    trackingUrl,
    getGrievanceOfficer,
    ACK_SLA_HOURS,
    RESOLUTION_SLA_DAYS,
  } = await import("@/lib/grievances");
  const { emailGrievanceReceived } = await import("@/lib/grievance-notify");

  const session = await getSession();

  // Link the order only when we can prove it belongs to the person complaining
  let orderId: string | null = null;
  if (d.orderRef) {
    const order = await db.order.findFirst({
      where: {
        orderNumber: d.orderRef.trim().toUpperCase(),
        ...(session ? { userId: session.uid } : { customerEmail: d.contactEmail.toLowerCase() }),
      },
      select: { id: true },
    });
    orderId = order?.id ?? null;
  }

  const amountPaise = d.amountClaimed ? Math.round(Number(d.amountClaimed) * 100) : null;
  if (amountPaise !== null && (!Number.isFinite(amountPaise) || amountPaise < 0)) {
    return { error: "Enter the disputed amount as a number, for example 459" };
  }

  const now = Date.now();
  const grievance = await db.grievance.create({
    data: {
      ticketNumber: await generateTicketNumber(),
      accessToken: generateAccessToken(),
      userId: session?.uid ?? null,
      orderId,
      orderRef: d.orderRef || null,
      category: d.category,
      subject: d.subject,
      description: d.description,
      contactName: d.contactName,
      contactEmail: d.contactEmail.toLowerCase(),
      contactPhone: d.contactPhone || null,
      paymentRef: d.paymentRef || null,
      amountClaimed: amountPaise,
      priority: priorityFor(d.category),
      ackDueAt: new Date(now + ACK_SLA_HOURS * 3600_000),
      dueAt: new Date(now + RESOLUTION_SLA_DAYS * 86400_000),
      events: {
        create: { status: "OPEN", note: "Complaint received", visibleToCustomer: true },
      },
    },
  });

  const officer = await getGrievanceOfficer();
  await emailGrievanceReceived(grievance, officer);

  return {
    ok: true,
    ticketNumber: grievance.ticketNumber,
    trackUrl: trackingUrl(grievance.accessToken),
  };
}

const replySchema = z.object({
  token: z.string().trim().length(48),
  message: z.string().trim().min(2, "Please type your reply").max(2000),
});

export async function addCustomerReply(
  token: string,
  message: string,
): Promise<{ ok?: boolean; error?: string }> {
  const ip = (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (!rateLimit(`grievance-reply:${ip}`, 20, 60 * 60 * 1000)) {
    return { error: "Too many replies just now. Please try again later." };
  }

  const parsed = replySchema.safeParse({ token, message });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const grievance = await db.grievance.findUnique({
    where: { accessToken: parsed.data.token },
    select: { id: true, ticketNumber: true, status: true, contactName: true },
  });
  if (!grievance) return { error: "This complaint could not be found." };
  if (["RESOLVED", "CLOSED"].includes(grievance.status)) {
    return { error: "This complaint is closed. Please file a new one if the issue persists." };
  }

  await db.$transaction([
    db.grievanceEvent.create({
      data: {
        grievanceId: grievance.id,
        status: "CUSTOMER_REPLY",
        note: parsed.data.message,
        byAdmin: false,
        visibleToCustomer: true,
      },
    }),
    // A reply puts the ball back with us
    db.grievance.update({
      where: { id: grievance.id },
      data: grievance.status === "AWAITING_CUSTOMER" ? { status: "IN_PROGRESS" } : {},
    }),
  ]);

  const { notifyOwnerOfReply } = await import("@/lib/grievance-notify");
  await notifyOwnerOfReply(grievance.ticketNumber, grievance.contactName, parsed.data.message);

  return { ok: true };
}
