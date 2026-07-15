import "server-only";
import { randomInt } from "node:crypto";

import { db } from "@/lib/db";
import { renderEmail, sendEmail } from "@/lib/email";

const OTP_TTL_MINUTES = 10;
const MAX_ATTEMPTS = 5;

export type OtpPurpose = "BULK_ORDER" | "COD_CONFIRM";

export async function issueOtp(email: string, purpose: OtpPurpose): Promise<boolean> {
  // Throttle: one active code per identifier+purpose, max 3 fresh issues/hour
  const hourAgo = new Date(Date.now() - 60 * 60 * 1000);
  const recent = await db.otpToken.count({
    where: { identifier: email, purpose, createdAt: { gte: hourAgo } },
  });
  if (recent >= 3) return false;

  const code = String(randomInt(100000, 999999));
  await db.otpToken.updateMany({
    where: { identifier: email, purpose, consumedAt: null },
    data: { consumedAt: new Date() }, // invalidate previous codes
  });
  await db.otpToken.create({
    data: {
      identifier: email,
      purpose,
      code,
      expiresAt: new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000),
    },
  });

  const reason =
    purpose === "COD_CONFIRM"
      ? "to confirm your Cash-on-Delivery order"
      : "to verify your bulk order";
  await sendEmail({
    to: email,
    subject: `${code} is your SLPL Store verification code`,
    template: `otp-${purpose.toLowerCase()}`,
    html: renderEmail(
      "Your verification code",
      `<p style="margin:0 0 12px">Use this code ${reason}. It is valid for ${OTP_TTL_MINUTES} minutes.</p>
       <p style="margin:0;text-align:center"><span style="display:inline-block;background:#eef2fa;border-radius:10px;padding:12px 28px;font-size:28px;letter-spacing:8px;font-weight:bold;color:#1e2a5a">${code}</span></p>
       <p style="margin:14px 0 0;font-size:13px;color:#5a6478">Didn't request this? You can ignore this email.</p>`,
    ),
  });
  return true;
}

export async function verifyOtp(
  email: string,
  purpose: OtpPurpose,
  code: string,
): Promise<{ ok: boolean; error?: string }> {
  const token = await db.otpToken.findFirst({
    where: { identifier: email, purpose, consumedAt: null },
    orderBy: { createdAt: "desc" },
  });
  if (!token) return { ok: false, error: "No active code - request a new one." };
  if (token.expiresAt < new Date()) return { ok: false, error: "Code expired - request a new one." };
  if (token.attempts >= MAX_ATTEMPTS) {
    return { ok: false, error: "Too many attempts - request a new code." };
  }

  if (token.code !== code.trim()) {
    await db.otpToken.update({ where: { id: token.id }, data: { attempts: { increment: 1 } } });
    return { ok: false, error: "Incorrect code - check and try again." };
  }

  await db.otpToken.update({ where: { id: token.id }, data: { consumedAt: new Date() } });
  return { ok: true };
}
