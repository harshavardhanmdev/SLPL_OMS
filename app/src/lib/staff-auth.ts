import "server-only";

import { cookies, headers } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
import bcrypt from "bcryptjs";

import { db } from "@/lib/db";
import { isAdmin } from "@/lib/admin-auth";

/**
 * Per-person staff logins with roles, replacing the single shared password.
 *
 * The shared password survives as a break-glass owner login, because locking
 * ourselves out of a live store would be worse than the risk it carries. Every
 * screen asks for a capability rather than a role, so adding a role later does
 * not mean hunting through pages.
 */

export type AdminRole =
  | "OWNER"
  | "MANAGER"
  | "SALES"
  | "WAREHOUSE"
  | "ACCOUNTS"
  | "CA_READONLY"
  | "SUPPORT";

export type StaffSession = {
  id: string;
  email: string;
  name: string;
  role: AdminRole;
  /** True when signed in with the shared password rather than a staff account. */
  breakGlass?: boolean;
};

const COOKIE = "slpl_staff";
const HOURS = 12;
const secretKey = () => new TextEncoder().encode(process.env.SESSION_SECRET!);

// ── Capabilities ─────────────────────────────────────────────────────────────
// A screen asks "can this person see money?" rather than "are they ACCOUNTS?".

export type Capability =
  | "store.manage" // products, coupons, sales, content
  | "orders.manage"
  | "shipments.manage"
  | "grievances.manage"
  | "finance.read"
  | "finance.write"
  | "staff.manage";

const ROLE_CAPABILITIES: Record<AdminRole, Capability[]> = {
  OWNER: [
    "store.manage",
    "orders.manage",
    "shipments.manage",
    "grievances.manage",
    "finance.read",
    "finance.write",
    "staff.manage",
  ],
  MANAGER: [
    "store.manage",
    "orders.manage",
    "shipments.manage",
    "grievances.manage",
    "finance.read",
    "finance.write",
  ],
  ACCOUNTS: ["orders.manage", "finance.read", "finance.write"],
  SALES: ["orders.manage", "grievances.manage"],
  WAREHOUSE: ["orders.manage", "shipments.manage"],
  SUPPORT: ["grievances.manage"],
  CA_READONLY: ["finance.read"],
};

export function roleCan(role: AdminRole, capability: Capability): boolean {
  return ROLE_CAPABILITIES[role]?.includes(capability) ?? false;
}

// ── Sessions ─────────────────────────────────────────────────────────────────

export async function signIn(
  email: string,
  password: string,
): Promise<{ session?: StaffSession; error?: string }> {
  const user = await db.adminUser.findUnique({ where: { email: email.trim().toLowerCase() } });
  if (!user || !user.isActive) return { error: "Wrong email or password." };
  if (!bcrypt.compareSync(password, user.passwordHash)) return { error: "Wrong email or password." };

  const jar = await headers();
  const expiresAt = new Date(Date.now() + HOURS * 60 * 60 * 1000);
  const row = await db.adminSession.create({
    data: {
      adminUserId: user.id,
      expiresAt,
      ip: jar.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
      userAgent: jar.get("user-agent")?.slice(0, 300) ?? null,
    },
  });
  await db.adminUser.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });

  const token = await new SignJWT({ sid: row.id })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${HOURS}h`)
    .sign(secretKey());
  const cookieJar = await cookies();
  cookieJar.set(COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: HOURS * 60 * 60,
  });

  return {
    session: { id: user.id, email: user.email, name: user.name, role: user.role as AdminRole },
  };
}

/** The signed-in person, or null. Falls back to the shared-password owner. */
export async function getStaff(): Promise<StaffSession | null> {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (token) {
    try {
      const { payload } = await jwtVerify(token, secretKey());
      const row = await db.adminSession.findUnique({
        where: { id: String(payload.sid) },
        include: { adminUser: true },
      });
      if (row && !row.revokedAt && row.expiresAt > new Date() && row.adminUser.isActive) {
        return {
          id: row.adminUser.id,
          email: row.adminUser.email,
          name: row.adminUser.name,
          role: row.adminUser.role as AdminRole,
        };
      }
    } catch {
      // fall through to break glass
    }
  }
  // The shared admin password still works, as the owner, so a lost staff
  // password can never lock everyone out of a live store.
  if (await isAdmin()) {
    return { id: "break-glass", email: "owner@slpl", name: "Owner", role: "OWNER", breakGlass: true };
  }
  return null;
}

export async function signOut(): Promise<void> {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (token) {
    try {
      const { payload } = await jwtVerify(token, secretKey());
      await db.adminSession.updateMany({
        where: { id: String(payload.sid), revokedAt: null },
        data: { revokedAt: new Date() },
      });
    } catch {
      // nothing to revoke
    }
  }
  jar.delete(COOKIE);
}

/** Throws nothing: returns null when allowed, a reason when not. */
export async function requireCapability(capability: Capability): Promise<string | null> {
  const staff = await getStaff();
  if (!staff) return "UNAUTHORIZED";
  return roleCan(staff.role, capability) ? null : "FORBIDDEN";
}
