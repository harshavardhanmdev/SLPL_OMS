import "server-only";

import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
import bcrypt from "bcryptjs";

import { db } from "@/lib/db";

/**
 * Quick unlock on a trusted phone.
 *
 * The full admin password is typed once on a device. After that the device
 * carries a long-lived signed cookie, and opening the expense log asks only for
 * a short PIN. Losing the phone is survivable: the PIN alone is useless without
 * the device cookie, and the cookie alone is useless without the PIN.
 */

const DEVICE_COOKIE = "slpl_erp_device";
const DEVICE_DAYS = 90;
const PIN_SETTING = "erp_expense_pin_hash";

const secretKey = () => new TextEncoder().encode(process.env.SESSION_SECRET!);

export async function rememberDevice(): Promise<void> {
  const token = await new SignJWT({ kind: "erp-device" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${DEVICE_DAYS}d`)
    .sign(secretKey());
  const jar = await cookies();
  jar.set(DEVICE_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: DEVICE_DAYS * 24 * 60 * 60,
  });
}

export async function forgetDevice(): Promise<void> {
  const jar = await cookies();
  jar.delete(DEVICE_COOKIE);
}

export async function isRememberedDevice(): Promise<boolean> {
  const jar = await cookies();
  const token = jar.get(DEVICE_COOKIE)?.value;
  if (!token) return false;
  try {
    const { payload } = await jwtVerify(token, secretKey());
    return payload.kind === "erp-device";
  } catch {
    return false;
  }
}

export async function hasPin(): Promise<boolean> {
  const row = await db.setting.findUnique({ where: { key: PIN_SETTING } });
  return typeof row?.value === "string" && row.value.length > 0;
}

export async function setPin(pin: string): Promise<void> {
  const hash = bcrypt.hashSync(pin, 10);
  await db.setting.upsert({
    where: { key: PIN_SETTING },
    update: { value: hash },
    create: { key: PIN_SETTING, value: hash },
  });
}

export async function clearPin(): Promise<void> {
  await db.setting.deleteMany({ where: { key: PIN_SETTING } });
}

export async function checkPin(pin: string): Promise<boolean> {
  const row = await db.setting.findUnique({ where: { key: PIN_SETTING } });
  if (typeof row?.value !== "string") return false;
  return bcrypt.compareSync(pin, row.value);
}
