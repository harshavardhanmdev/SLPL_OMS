import "server-only";

import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
import bcrypt from "bcryptjs";

import { db } from "@/lib/db";

/**
 * School staff sign in with their school code and a PIN we give them, which
 * gets them exactly one power: marking their own school's kits collected.
 * They never touch the admin panel, and the session names the school, so a
 * receipt from another school stays unusable even with a valid PIN.
 */

const COOKIE = "slpl_school";
const HOURS = 12;

const secretKey = () => new TextEncoder().encode(process.env.SESSION_SECRET!);

export type StaffSession = { schoolId: string; schoolName: string; staffName: string };

export function hashPin(pin: string): string {
  return bcrypt.hashSync(pin, 10);
}

export async function checkSchoolPin(
  code: string,
  pin: string,
): Promise<{ id: string; name: string } | null> {
  const school = await db.school.findFirst({
    where: { code: code.trim().toUpperCase(), isActive: true },
    select: { id: true, name: true, verifyPin: true },
  });
  if (!school?.verifyPin) return null;
  if (!bcrypt.compareSync(pin, school.verifyPin)) return null;
  return { id: school.id, name: school.name };
}

export async function createStaffSession(session: StaffSession): Promise<void> {
  const token = await new SignJWT({ ...session, role: "school" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${HOURS}h`)
    .sign(secretKey());
  const jar = await cookies();
  jar.set(COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: HOURS * 60 * 60,
  });
}

export async function getStaffSession(): Promise<StaffSession | null> {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secretKey());
    if (payload.role !== "school") return null;
    return {
      schoolId: String(payload.schoolId),
      schoolName: String(payload.schoolName),
      staffName: String(payload.staffName),
    };
  } catch {
    return null;
  }
}

export async function destroyStaffSession(): Promise<void> {
  const jar = await cookies();
  jar.delete(COOKIE);
}
