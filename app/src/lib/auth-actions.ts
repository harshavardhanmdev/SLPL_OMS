"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";

import { db } from "@/lib/db";
import { createSession, destroySession, hashPassword, verifyPassword } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";

async function ipKey(scope: string): Promise<string> {
  const h = await headers();
  const ip = h.get("cf-connecting-ip") ?? h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  return `${scope}:${ip}`;
}

export type AuthFormState = { error?: string };

/** Only allow same-site relative targets for post-auth redirects. */
function safeNext(raw: FormDataEntryValue | null, fallback: string): string {
  const next = typeof raw === "string" ? raw : "";
  return next.startsWith("/") && !next.startsWith("//") ? next : fallback;
}

const signupSchema = z.object({
  name: z.string().trim().min(2, "Please enter your name").max(80),
  email: z.string().trim().toLowerCase().email("Enter a valid email"),
  phone: z
    .string()
    .trim()
    .regex(/^[6-9][0-9]{9}$/, "Enter a valid 10-digit Indian mobile number")
    .optional()
    .or(z.literal("")),
  password: z.string().min(8, "Password must be at least 8 characters").max(100),
});

export async function signupAction(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  if (!rateLimit(await ipKey("signup"), 10, 60 * 60 * 1000)) {
    return { error: "Too many attempts — please try again later." };
  }
  const parsed = signupSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    phone: formData.get("phone"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }
  const { name, email, phone, password } = parsed.data;

  const existing = await db.user.findUnique({ where: { email } });
  if (existing) {
    return { error: "An account with this email already exists — try logging in." };
  }

  const user = await db.user.create({
    data: { name, email, phone: phone || null, passwordHash: await hashPassword(password) },
  });
  await createSession({ uid: user.id, name: user.name, email: user.email });
  redirect(safeNext(formData.get("next"), "/account"));
}

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email"),
  password: z.string().min(1, "Enter your password"),
});

export async function loginAction(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  if (!rateLimit(await ipKey("login"), 20, 15 * 60 * 1000)) {
    return { error: "Too many attempts — please try again in 15 minutes." };
  }
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }
  const { email, password } = parsed.data;

  const user = await db.user.findUnique({ where: { email } });
  // Uniform error avoids leaking which emails are registered
  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    return { error: "Incorrect email or password." };
  }

  await createSession({ uid: user.id, name: user.name, email: user.email });
  redirect(safeNext(formData.get("next"), "/account"));
}

export async function logoutAction(): Promise<void> {
  await destroySession();
  redirect("/");
}
