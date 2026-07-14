import "server-only";
import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
import bcrypt from "bcryptjs";

const SESSION_COOKIE = "slpl_session";
/** Non-httpOnly marker so client code (cart sync) knows a session exists. */
export const AUTH_MARKER_COOKIE = "slpl_authed";
const SESSION_DAYS = 30;

function secretKey() {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("SESSION_SECRET env var must be set (32+ chars)");
  }
  return new TextEncoder().encode(secret);
}

export type SessionUser = { uid: string; name: string; email: string };

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 11);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export async function createSession(user: SessionUser): Promise<void> {
  const token = await new SignJWT(user)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DAYS}d`)
    .sign(secretKey());

  const jar = await cookies();
  const maxAge = SESSION_DAYS * 24 * 60 * 60;
  const secure = process.env.NODE_ENV === "production";
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure,
    sameSite: "lax",
    path: "/",
    maxAge,
  });
  jar.set(AUTH_MARKER_COOKIE, "1", {
    httpOnly: false,
    secure,
    sameSite: "lax",
    path: "/",
    maxAge,
  });
}

export async function getSession(): Promise<SessionUser | null> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify<SessionUser>(token, secretKey());
    return { uid: payload.uid, name: payload.name, email: payload.email };
  } catch {
    return null;
  }
}

export async function destroySession(): Promise<void> {
  const jar = await cookies();
  jar.delete(SESSION_COOKIE);
  jar.delete(AUTH_MARKER_COOKIE);
}
