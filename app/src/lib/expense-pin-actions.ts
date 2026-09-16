"use server";

import { revalidatePath } from "next/cache";

import { clientIp, createAdminSession, isAdmin, isLockedOut, recordLoginResult } from "@/lib/admin-auth";
import {
  checkPin,
  clearPin,
  forgetDevice,
  isRememberedDevice,
  rememberDevice,
  setPin,
} from "@/lib/expense-pin";

type Result = { ok?: boolean; error?: string };

/** Trust this phone, so future visits ask for the PIN rather than the password. */
export async function trustThisDevice(pin: string): Promise<Result> {
  if (!(await isAdmin())) return { error: "Sign in with the password first." };
  if (!/^[0-9]{4,8}$/.test(pin.trim())) return { error: "PIN must be 4 to 8 digits." };
  await setPin(pin.trim());
  await rememberDevice();
  revalidatePath("/erp");
  return { ok: true };
}

export async function untrustThisDevice(): Promise<Result> {
  if (!(await isAdmin())) return { error: "Sign in first." };
  await forgetDevice();
  await clearPin();
  revalidatePath("/erp");
  return { ok: true };
}

/**
 * Unlock with the PIN. Shares the admin lockout counter, so guessing a 4 digit
 * PIN is rate limited exactly like guessing the password.
 */
export async function unlockWithPin(pin: string): Promise<Result> {
  const ip = await clientIp();
  if (isLockedOut(ip)) return { error: "Too many wrong attempts - locked for 15 minutes." };
  if (!(await isRememberedDevice())) return { error: "This device is not set up. Use the password." };

  const ok = await checkPin(pin.trim());
  recordLoginResult(ip, ok);
  if (!ok) return { error: "Wrong PIN." };

  await createAdminSession();
  return { ok: true };
}
