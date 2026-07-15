import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { randomBytes } from "node:crypto";

import { db } from "@/lib/db";
import { createSession, hashPassword } from "@/lib/auth";

export const dynamic = "force-dynamic";

/** Step 2 of Login with Google: verify state, exchange code, sign the user in. */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const fail = (reason: string) =>
    NextResponse.redirect(new URL(`/login?error=${encodeURIComponent(reason)}`, url.origin));

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const appUrl = process.env.APP_URL;
  if (!clientId || !clientSecret || !appUrl) return fail("google-not-configured");

  const jar = await cookies();
  const stored = jar.get("slpl_oauth")?.value;
  jar.delete("slpl_oauth");
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  if (!stored || !code || !state) return fail("google-cancelled");

  let next = "/account";
  try {
    const parsed = JSON.parse(stored) as { state: string; next: string };
    if (parsed.state !== state) return fail("google-state-mismatch");
    if (parsed.next.startsWith("/") && !parsed.next.startsWith("//")) next = parsed.next;
  } catch {
    return fail("google-state-mismatch");
  }

  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: `${appUrl}/api/auth/google/callback`,
      grant_type: "authorization_code",
    }),
  });
  if (!tokenRes.ok) return fail("google-token-failed");
  const { access_token } = (await tokenRes.json()) as { access_token?: string };
  if (!access_token) return fail("google-token-failed");

  const infoRes = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
    headers: { Authorization: `Bearer ${access_token}` },
  });
  if (!infoRes.ok) return fail("google-userinfo-failed");
  const info = (await infoRes.json()) as {
    email?: string;
    email_verified?: boolean;
    name?: string;
    picture?: string;
  };
  if (!info.email || info.email_verified === false) return fail("google-email-unverified");

  const email = info.email.toLowerCase();
  const existing = await db.user.findUnique({ where: { email } });
  const user = existing
    ? await db.user.update({
        where: { id: existing.id },
        data: {
          lastLoginAt: new Date(),
          emailVerified: existing.emailVerified ?? new Date(),
          image: existing.image ?? info.picture ?? null,
        },
      })
    : await db.user.create({
        data: {
          email,
          name: info.name ?? email.split("@")[0],
          // Google users get an unguessable local password they never use
          passwordHash: await hashPassword(randomBytes(24).toString("hex")),
          emailVerified: new Date(),
          image: info.picture ?? null,
          lastLoginAt: new Date(),
        },
      });

  await createSession({ uid: user.id, name: user.name, email: user.email });
  return NextResponse.redirect(new URL(next, url.origin));
}
