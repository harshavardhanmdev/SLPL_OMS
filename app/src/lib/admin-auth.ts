import "server-only";
import { cookies, headers } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
import bcrypt from "bcryptjs";

const ADMIN_COOKIE = "slpl_admin";
const ADMIN_HOURS = 12;

function secretKey() {
  return new TextEncoder().encode(process.env.SESSION_SECRET!);
}

/**
 * Production: set ADMIN_PASSWORD_HASH (bcrypt). Dev fallback: ADMIN_PASSWORD
 * plain. Rotate by changing the env value and restarting — no DB involved.
 */
export async function checkAdminPassword(password: string): Promise<boolean> {
  const hash = process.env.ADMIN_PASSWORD_HASH;
  if (hash) return bcrypt.compare(password, hash);
  const plain = process.env.ADMIN_PASSWORD;
  return Boolean(plain) && password === plain;
}

// ── Brute-force lockout (in-memory; per app instance) ──
const attempts = new Map<string, { fails: number; lockedUntil: number }>();
const MAX_FAILS = 5;
const LOCK_MS = 15 * 60 * 1000;

export async function clientIp(): Promise<string> {
  const h = await headers();
  return (
    h.get("cf-connecting-ip") ??
    h.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "local"
  );
}

export function isLockedOut(ip: string): boolean {
  const rec = attempts.get(ip);
  return Boolean(rec && rec.lockedUntil > Date.now());
}

export function recordLoginResult(ip: string, ok: boolean): void {
  if (ok) {
    attempts.delete(ip);
    return;
  }
  const rec = attempts.get(ip) ?? { fails: 0, lockedUntil: 0 };
  rec.fails += 1;
  if (rec.fails >= MAX_FAILS) {
    rec.lockedUntil = Date.now() + LOCK_MS;
    rec.fails = 0;
  }
  attempts.set(ip, rec);
}

export async function createAdminSession(): Promise<void> {
  const token = await new SignJWT({ role: "admin" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${ADMIN_HOURS}h`)
    .sign(secretKey());
  const jar = await cookies();
  jar.set(ADMIN_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: ADMIN_HOURS * 60 * 60,
  });
}

export async function isAdmin(): Promise<boolean> {
  const jar = await cookies();
  const token = jar.get(ADMIN_COOKIE)?.value;
  if (!token) return false;
  try {
    const { payload } = await jwtVerify(token, secretKey());
    return payload.role === "admin";
  } catch {
    return false;
  }
}

export async function destroyAdminSession(): Promise<void> {
  const jar = await cookies();
  jar.delete(ADMIN_COOKIE);
}
