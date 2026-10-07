import "server-only";

import { readFile } from "node:fs/promises";
import path from "node:path";

import { getSetting } from "@/lib/catalog";
import { site } from "@/lib/site";

/**
 * Everything that goes on a printed document.
 *
 * Kept in `Setting` rather than hardcoded, because a bank account or a GSTIN
 * changing should not need a deploy. `src/lib/site.ts` supplies the fallbacks,
 * so a fresh database still prints something sensible.
 */

export type CompanyProfile = {
  name: string;
  tagline: string;
  address: string;
  phone: string;
  altPhone: string;
  email: string;
  website: string;
  gstin: string;
  pan: string;
  cin: string;
  bankName: string;
  bankAccountNo: string;
  bankIfsc: string;
  bankBranch: string;
  upiId: string;
  /** Inlined as a data URI, never a URL, so the file stays admin only. */
  signature: string | null;
};

const UPLOADS_DIR = process.env.UPLOADS_DIR ?? path.join(process.cwd(), "uploads");

/**
 * The signature as a data URI.
 *
 * It is stored with the `receipt-` prefix so `/media/[...file]` refuses to
 * serve it to anyone who is not an admin. A director's signature sitting on a
 * permanent public URL is a forgery kit, so it is read off disk here and
 * embedded in the page instead of being linked.
 */
async function signatureDataUri(name: string | null): Promise<string | null> {
  if (!name) return null;
  const file = name.replace(/^\/media\//, "");
  if (!/^[a-z0-9][a-z0-9.-]*$/i.test(file) || file.includes("..")) return null;
  try {
    const bytes = await readFile(path.join(UPLOADS_DIR, file));
    const ext = path.extname(file).toLowerCase();
    const type = ext === ".png" ? "image/png" : ext === ".webp" ? "image/webp" : "image/jpeg";
    return `data:${type};base64,${bytes.toString("base64")}`;
  } catch {
    // A missing signature prints a blank line rather than failing the document
    return null;
  }
}

export async function getCompany(): Promise<CompanyProfile> {
  const [
    tagline,
    address,
    phone,
    altPhone,
    email,
    gstin,
    pan,
    cin,
    bankName,
    bankAccountNo,
    bankIfsc,
    bankBranch,
    upiId,
    signatureFile,
  ] = await Promise.all([
    getSetting<string>("company_tagline", "BRINGING A CHANGE YOU WISH FOR"),
    getSetting<string>("company_address", site.contact.address),
    getSetting<string>("contact_phone", site.contact.phone),
    getSetting<string>("company_alt_phone", ""),
    getSetting<string>("contact_email", site.contact.email),
    getSetting<string>("company_gstin", ""),
    getSetting<string>("company_pan", ""),
    getSetting<string>("company_cin", ""),
    getSetting<string>("bank_name", ""),
    getSetting<string>("bank_account_no", ""),
    getSetting<string>("bank_ifsc", ""),
    getSetting<string>("bank_branch", ""),
    getSetting<string>("upi_id", ""),
    getSetting<string>("signature_image", ""),
  ]);

  return {
    name: "SAARADAA LEARKNOWATIONS PRIVATE LIMITED",
    tagline,
    address,
    phone,
    altPhone,
    email,
    website: site.links.main,
    gstin,
    pan,
    cin,
    bankName,
    bankAccountNo,
    bankIfsc,
    bankBranch,
    upiId,
    signature: await signatureDataUri(signatureFile || null),
  };
}

/**
 * The UPI payment string a phone understands when it scans the QR.
 *
 * No amount, because phone apps then lock it and a school paying part of a
 * bill could not; the amount due is printed beside the QR instead. `tn`
 * carries the document number so the money arriving can be matched to the
 * bill it paid.
 */
export function upiPayload(company: CompanyProfile, note: string): string {
  const params = new URLSearchParams({
    pa: company.upiId,
    pn: company.name,
    cu: "INR",
    tn: note.slice(0, 50),
  });
  return `upi://pay?${params.toString()}`;
}
