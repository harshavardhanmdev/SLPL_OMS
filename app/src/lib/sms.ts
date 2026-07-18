import "server-only";

/**
 * Transactional SMS via Brevo. Dormant until BREVO_API_KEY is set in the
 * server env (deploy/.env) - every call is then still fire-and-forget so a
 * provider outage can never break an order flow.
 *
 * India note: delivery requires a DLT-registered sender ID and template;
 * see docs/INTEGRATIONS.md before going live.
 */

export function isSmsConfigured(): boolean {
  return Boolean(process.env.BREVO_API_KEY);
}

/** Normalize an Indian mobile number to E.164 (+91XXXXXXXXXX). Returns null if hopeless. */
function toE164(phone: string): string | null {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 10 && /^[6-9]/.test(digits)) return `+91${digits}`;
  if (digits.length === 12 && digits.startsWith("91")) return `+${digits}`;
  return null;
}

export async function sendSms(phone: string | null | undefined, message: string): Promise<void> {
  if (!isSmsConfigured() || !phone) return;
  const recipient = toE164(phone);
  if (!recipient) return;
  try {
    const res = await fetch("https://api.brevo.com/v3/transactionalSMS/sms", {
      method: "POST",
      headers: {
        "api-key": process.env.BREVO_API_KEY!,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        type: "transactional",
        sender: process.env.SMS_SENDER ?? "SLPL",
        recipient,
        content: message,
      }),
    });
    if (!res.ok) {
      console.error("[sms] Brevo rejected", res.status, await res.text().catch(() => ""));
    }
  } catch (err) {
    console.error("[sms] send failed", err);
  }
}
