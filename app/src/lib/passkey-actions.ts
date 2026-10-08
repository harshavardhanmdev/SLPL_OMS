"use server";

import { revalidatePath } from "next/cache";
import { cookies, headers } from "next/headers";
import { jwtVerify, SignJWT } from "jose";
import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
  type AuthenticationResponseJSON,
  type PublicKeyCredentialCreationOptionsJSON,
  type PublicKeyCredentialRequestOptionsJSON,
  type RegistrationResponseJSON,
} from "@simplewebauthn/server";

import { audit } from "@/lib/audit";
import { clientIp, isLockedOut, recordLoginResult } from "@/lib/admin-auth";
import { db } from "@/lib/db";
import { getStaff, startSession } from "@/lib/staff-auth";

/**
 * Signing in with a fingerprint or face, as a WebAuthn passkey kept on the
 * phone. The phone proves it holds the key, and the person unlocks it with
 * their own finger or face; nothing biometric ever reaches us.
 *
 * The one-time challenge travels in a short-lived signed cookie, so there is
 * no table of half-finished attempts to clean up.
 */

type Result = { ok?: boolean; error?: string };

const CHALLENGE = "slpl_passkey";
const secretKey = () => new TextEncoder().encode(process.env.SESSION_SECRET!);

/** The site the passkey belongs to, from the address the person is on. */
async function relyingParty() {
  const h = await headers();
  const host = (h.get("x-forwarded-host") ?? h.get("host") ?? "").split(",")[0].trim();
  // A browser only offers passkeys on https or localhost, so either scheme here is what it used
  return { rpID: host.replace(/:\d+$/, ""), origins: [`https://${host}`, `http://${host}`] };
}

async function keepChallenge(challenge: string, purpose: "register" | "signin") {
  const token = await new SignJWT({ challenge, purpose })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("5m")
    .sign(secretKey());
  (await cookies()).set(CHALLENGE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production" && process.env.DEMO_MODE !== "1",
    sameSite: "strict",
    path: "/",
    maxAge: 300,
  });
}

/** The challenge handed out for this purpose, used once. */
async function takeChallenge(purpose: "register" | "signin"): Promise<string | null> {
  const jar = await cookies();
  const token = jar.get(CHALLENGE)?.value;
  jar.delete(CHALLENGE);
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secretKey());
    return payload.purpose === purpose ? String(payload.challenge) : null;
  } catch {
    return null;
  }
}

/** "Android phone, Chrome", so a list of them reads as the devices they are. */
async function deviceName(): Promise<string> {
  const ua = (await headers()).get("user-agent") ?? "";
  const device = /iPhone/.test(ua)
    ? "iPhone"
    : /iPad/.test(ua)
      ? "iPad"
      : /Android/.test(ua)
        ? "Android phone"
        : /Mac OS X/.test(ua)
          ? "Mac"
          : /Windows/.test(ua)
            ? "Windows computer"
            : "This device";
  const browser = /Edg\//.test(ua)
    ? "Edge"
    : /SamsungBrowser/.test(ua)
      ? "Samsung Internet"
      : /Chrome\//.test(ua)
        ? "Chrome"
        : /Firefox\//.test(ua)
          ? "Firefox"
          : /Safari\//.test(ua)
            ? "Safari"
            : "";
  return browser ? `${device}, ${browser}` : device;
}

export async function passkeyRegisterOptions(): Promise<{
  options?: PublicKeyCredentialCreationOptionsJSON;
  error?: string;
}> {
  const staff = await getStaff();
  if (!staff || staff.breakGlass) return { error: "Sign in with your own account first." };
  const { rpID } = await relyingParty();
  const existing = await db.staffPasskey.findMany({
    where: { adminUserId: staff.id },
    select: { credentialId: true, transports: true },
  });
  const options = await generateRegistrationOptions({
    rpName: "SLPL Back office",
    rpID,
    userName: staff.email,
    userDisplayName: staff.name,
    userID: new TextEncoder().encode(staff.id),
    attestationType: "none",
    // One per phone: the same phone is not offered twice
    excludeCredentials: existing.map((p) => ({ id: p.credentialId, transports: p.transports })),
    // Kept on the phone and unlocked with the person's own finger or face
    authenticatorSelection: {
      residentKey: "required",
      userVerification: "required",
      authenticatorAttachment: "platform",
    },
  });
  await keepChallenge(options.challenge, "register");
  return { options };
}

export async function passkeyRegister(response: RegistrationResponseJSON): Promise<Result> {
  const staff = await getStaff();
  if (!staff || staff.breakGlass) return { error: "Sign in with your own account first." };
  const expectedChallenge = await takeChallenge("register");
  if (!expectedChallenge) return { error: "That took too long. Try again." };
  const { rpID, origins } = await relyingParty();

  let verified;
  try {
    verified = await verifyRegistrationResponse({
      response,
      expectedChallenge,
      expectedOrigin: origins,
      expectedRPID: rpID,
      requireUserVerification: true,
    });
  } catch {
    return { error: "This phone could not set it up. Try again." };
  }
  if (!verified.verified) return { error: "This phone could not set it up. Try again." };

  const { credential } = verified.registrationInfo;
  const row = await db.staffPasskey.create({
    data: {
      adminUserId: staff.id,
      credentialId: credential.id,
      publicKey: Buffer.from(credential.publicKey),
      counter: credential.counter,
      transports: credential.transports ?? [],
      deviceName: await deviceName(),
    },
  });
  await audit({
    action: "staff.passkey.add",
    entityType: "AdminUser",
    entityId: staff.id,
    after: { device: row.deviceName },
  });
  revalidatePath("/erp/passkeys");
  return { ok: true };
}

export async function passkeySignInOptions(): Promise<{
  options?: PublicKeyCredentialRequestOptionsJSON;
  error?: string;
}> {
  const { rpID } = await relyingParty();
  // No email asked for: the phone offers the passkeys it holds for this site
  const options = await generateAuthenticationOptions({ rpID, userVerification: "required" });
  await keepChallenge(options.challenge, "signin");
  return { options };
}

export async function passkeySignIn(response: AuthenticationResponseJSON): Promise<Result> {
  const ip = await clientIp();
  if (isLockedOut(ip)) return { error: "Too many wrong attempts - locked for 15 minutes." };
  const expectedChallenge = await takeChallenge("signin");
  if (!expectedChallenge) return { error: "That took too long. Try again." };

  const passkey = await db.staffPasskey.findUnique({
    where: { credentialId: response.id },
    include: { adminUser: true },
  });
  // Removed, or never set up here: the password still works
  if (!passkey || !passkey.adminUser.isActive) {
    recordLoginResult(ip, false);
    return { error: "This phone is not set up for fingerprint sign-in. Sign in with your password." };
  }

  const { rpID, origins } = await relyingParty();
  let verified;
  try {
    verified = await verifyAuthenticationResponse({
      response,
      expectedChallenge,
      expectedOrigin: origins,
      expectedRPID: rpID,
      credential: {
        id: passkey.credentialId,
        publicKey: new Uint8Array(passkey.publicKey),
        counter: passkey.counter,
        transports: passkey.transports,
      },
      requireUserVerification: true,
    });
  } catch {
    verified = { verified: false as const };
  }
  recordLoginResult(ip, verified.verified);
  if (!verified.verified) return { error: "That did not work. Sign in with your password." };

  await db.staffPasskey.update({
    where: { id: passkey.id },
    data: { counter: verified.authenticationInfo.newCounter, lastUsedAt: new Date() },
  });
  // A fingerprint or face is the person's own phone, so it is trusted like one
  await startSession(passkey.adminUser, true);
  await audit({
    action: "staff.signin",
    entityType: "AdminUser",
    entityId: passkey.adminUser.id,
    after: { with: "passkey", device: passkey.deviceName },
  });
  return { ok: true };
}

/** A person removes one of their own, such as an old phone. */
export async function removePasskey(id: string): Promise<Result> {
  const staff = await getStaff();
  if (!staff || staff.breakGlass) return { error: "Sign in with your own account first." };
  const passkey = await db.staffPasskey.findUnique({ where: { id } });
  if (!passkey || passkey.adminUserId !== staff.id) return { error: "That is not yours to remove." };
  await db.staffPasskey.delete({ where: { id } });
  await audit({
    action: "staff.passkey.remove",
    entityType: "AdminUser",
    entityId: staff.id,
    before: { device: passkey.deviceName },
  });
  revalidatePath("/erp/passkeys");
  return { ok: true };
}
