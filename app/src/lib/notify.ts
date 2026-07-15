import "server-only";

import { db } from "@/lib/db";

export type NotificationPrefs = {
  orderEmails: boolean; // shipped / out-for-delivery / delivered emails
  promoEmails: boolean;
};

export const DEFAULT_PREFS: NotificationPrefs = { orderEmails: true, promoEmails: true };

export async function getPrefs(userId: string): Promise<NotificationPrefs> {
  const user = await db.user.findUnique({ where: { id: userId }, select: { notificationPrefs: true } });
  return { ...DEFAULT_PREFS, ...((user?.notificationPrefs as Partial<NotificationPrefs>) ?? {}) };
}

/** In-app notification row; shown on the customer's account page. */
export async function notifyUser(
  userId: string,
  title: string,
  body: string,
  href?: string,
): Promise<void> {
  await db.notification
    .create({ data: { userId, title, body, href } })
    .catch((err) => console.error("[notify]", err));
}
