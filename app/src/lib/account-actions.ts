"use server";

import { z } from "zod";

import { getSession, createSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { DEFAULT_PREFS, type NotificationPrefs } from "@/lib/notify";

const profileSchema = z.object({
  name: z.string().trim().min(2, "Please enter your name").max(80),
  phone: z
    .string()
    .trim()
    .regex(/^[6-9][0-9]{9}$/, "Enter a valid 10-digit mobile number")
    .optional()
    .or(z.literal("")),
});

export async function updateProfile(input: {
  name: string;
  phone: string;
}): Promise<{ ok?: boolean; error?: string }> {
  const session = await getSession();
  if (!session) return { error: "Please log in again." };
  const parsed = profileSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const user = await db.user.update({
    where: { id: session.uid },
    data: { name: parsed.data.name, phone: parsed.data.phone || null },
  });
  // Refresh the session so the header greeting shows the new name
  await createSession({ uid: user.id, name: user.name, email: user.email });
  return { ok: true };
}

export async function savePrefs(prefs: NotificationPrefs): Promise<{ ok: boolean }> {
  const session = await getSession();
  if (!session) return { ok: false };
  const clean: NotificationPrefs = {
    orderEmails: Boolean(prefs.orderEmails),
    promoEmails: Boolean(prefs.promoEmails),
  };
  await db.user.update({
    where: { id: session.uid },
    data: { notificationPrefs: { ...DEFAULT_PREFS, ...clean } },
  });
  return { ok: true };
}

export async function markNotificationsRead(): Promise<{ ok: boolean }> {
  const session = await getSession();
  if (!session) return { ok: false };
  await db.notification.updateMany({
    where: { userId: session.uid, readAt: null },
    data: { readAt: new Date() },
  });
  return { ok: true };
}
