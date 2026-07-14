import "server-only";
import nodemailer from "nodemailer";

import { db } from "@/lib/db";

/**
 * SMTP from env. Dev: Mailpit (tunnel localhost:11025 → server). Prod: Brevo /
 * Hostinger mailbox — see docs/INTEGRATIONS.md.
 */
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST ?? "127.0.0.1",
  port: Number(process.env.SMTP_PORT ?? 1025),
  secure: process.env.SMTP_SECURE === "1",
  auth: process.env.SMTP_USER
    ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
    : undefined,
});

const FROM = process.env.SMTP_FROM ?? "SLPL Store <store@theslpl.in>";
const OWNER = process.env.OWNER_NOTIFY_EMAIL ?? "saradapublications18@gmail.com";

export function renderEmail(title: string, bodyHtml: string): string {
  return `<!doctype html>
<html><body style="margin:0;background:#f4f6fb;font-family:Arial,Helvetica,sans-serif;color:#16213e">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px 12px">
    <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e3e8f2">
      <tr><td style="background:#1e2a5a;padding:18px 24px">
        <span style="color:#ffffff;font-size:18px;font-weight:bold">SLPL Store</span>
        <span style="color:#f5a623;font-size:12px;display:block;margin-top:2px">Saaradaa Learknowations Pvt Ltd</span>
      </td></tr>
      <tr><td style="padding:24px">
        <h1 style="margin:0 0 14px;font-size:20px;color:#1e2a5a">${title}</h1>
        ${bodyHtml}
      </td></tr>
      <tr><td style="padding:16px 24px;border-top:1px solid #e3e8f2;font-size:12px;color:#5a6478">
        Saaradaa Learknowations Pvt Ltd · Nagole, Hyderabad · +91 79891 91962<br>
        This is an automated message from the SLPL Store.
      </td></tr>
    </table>
  </td></tr></table>
</body></html>`;
}

export async function sendEmail(opts: {
  to: string;
  subject: string;
  html: string;
  template: string;
}): Promise<boolean> {
  try {
    await transporter.sendMail({ from: FROM, to: opts.to, subject: opts.subject, html: opts.html });
    await db.emailLog.create({
      data: { to: opts.to, subject: opts.subject, template: opts.template, status: "SENT" },
    });
    return true;
  } catch (err) {
    await db.emailLog
      .create({
        data: {
          to: opts.to,
          subject: opts.subject,
          template: opts.template,
          status: "FAILED",
          error: err instanceof Error ? err.message : String(err),
        },
      })
      .catch(() => {});
    console.error("[email] send failed", opts.template, err);
    return false;
  }
}

export async function notifyOwner(subject: string, html: string, template: string): Promise<void> {
  await sendEmail({ to: OWNER, subject, html, template });
}
