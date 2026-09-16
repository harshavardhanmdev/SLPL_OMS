"use server";

import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";
import { z } from "zod";

import { audit } from "@/lib/audit";
import { clientIp, isLockedOut, recordLoginResult } from "@/lib/admin-auth";
import { db } from "@/lib/db";
import { getStaff, requireCapability, signIn, signOut, type AdminRole } from "@/lib/staff-auth";

type Result = { ok?: boolean; error?: string };

export async function staffSignIn(
  email: string,
  password: string,
): Promise<{ ok?: boolean; error?: string }> {
  const ip = await clientIp();
  if (isLockedOut(ip)) return { error: "Too many wrong attempts - locked for 15 minutes." };

  const res = await signIn(email, password);
  recordLoginResult(ip, Boolean(res.session));
  if (res.error) return { error: res.error };

  await audit({ action: "staff.signin", entityType: "AdminUser", entityId: res.session!.id });
  return { ok: true };
}

export async function staffSignOut(): Promise<void> {
  await audit({ action: "staff.signout" });
  await signOut();
}

const ROLES: AdminRole[] = [
  "OWNER",
  "MANAGER",
  "SALES",
  "WAREHOUSE",
  "ACCOUNTS",
  "CA_READONLY",
  "SUPPORT",
];

const staffSchema = z.object({
  id: z.string().optional(),
  email: z.string().trim().toLowerCase().email("Enter a valid email"),
  name: z.string().trim().min(2, "Enter their name").max(80),
  role: z.string().min(1),
  password: z.string().min(8, "Password must be at least 8 characters").optional().or(z.literal("")),
  isActive: z.boolean(),
});

export type StaffInput = z.infer<typeof staffSchema>;

export async function saveStaff(input: StaffInput): Promise<Result> {
  const denied = await requireCapability("staff.manage");
  if (denied) return { error: denied };

  const parsed = staffSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const d = parsed.data;
  if (!ROLES.includes(d.role as AdminRole)) return { error: "Pick a role from the list." };

  const clash = await db.adminUser.findFirst({
    where: { email: d.email, ...(d.id ? { NOT: { id: d.id } } : {}) },
  });
  if (clash) return { error: `${d.email} already has an account.` };

  if (!d.id && !d.password) return { error: "Set a password for the new account." };

  const before = d.id ? await db.adminUser.findUnique({ where: { id: d.id } }) : null;
  const data = {
    email: d.email,
    name: d.name,
    role: d.role as never,
    isActive: d.isActive,
    ...(d.password ? { passwordHash: bcrypt.hashSync(d.password, 10) } : {}),
  };
  const row = d.id
    ? await db.adminUser.update({ where: { id: d.id }, data })
    : await db.adminUser.create({ data: { ...data, passwordHash: bcrypt.hashSync(d.password!, 10) } });

  // A changed password or a deactivated account ends every open session
  if (d.password || !d.isActive) {
    await db.adminSession.updateMany({
      where: { adminUserId: row.id, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  await audit({
    action: d.id ? "staff.update" : "staff.create",
    entityType: "AdminUser",
    entityId: row.id,
    // Never write a password hash into the audit trail
    before: before ? { ...before, passwordHash: undefined } : null,
    after: { ...row, passwordHash: undefined },
  });
  revalidatePath("/erp/staff");
  return { ok: true };
}

export async function revokeSessions(adminUserId: string): Promise<Result> {
  const denied = await requireCapability("staff.manage");
  if (denied) return { error: denied };
  const res = await db.adminSession.updateMany({
    where: { adminUserId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
  await audit({ action: "staff.revoke", entityType: "AdminUser", entityId: adminUserId });
  revalidatePath("/erp/staff");
  return res.count > 0 ? { ok: true } : { error: "They had no active sessions." };
}

/** Anyone signed in can change their own password. */
export async function changeOwnPassword(current: string, next: string): Promise<Result> {
  const staff = await getStaff();
  if (!staff) return { error: "Sign in again." };
  if (staff.breakGlass) return { error: "Change the shared password in the server .env instead." };
  if (next.length < 8) return { error: "New password must be at least 8 characters." };

  const user = await db.adminUser.findUnique({ where: { id: staff.id } });
  if (!user || !bcrypt.compareSync(current, user.passwordHash)) {
    return { error: "Current password is wrong." };
  }
  await db.adminUser.update({
    where: { id: user.id },
    data: { passwordHash: bcrypt.hashSync(next, 10), mustChangePassword: false },
  });
  await audit({ action: "staff.password", entityType: "AdminUser", entityId: user.id });
  return { ok: true };
}
