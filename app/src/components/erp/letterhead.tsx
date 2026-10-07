import Image from "next/image";

import type { CompanyProfile } from "@/lib/company";
import { formatINR } from "@/lib/money";

/**
 * The printed header and footer, shared by the quotation, the invoice and the
 * delivery challan so the three can never drift apart.
 *
 * Colours are literal hex rather than theme tokens, because these pages are
 * printed and must not follow the reader's dark mode. The print: sizes are
 * smaller than the screen ones so a normal bill fits on one A4 sheet.
 */

export const DOC_BLUE = "#1668B3";
export const DOC_NAVY = "#1E2A5A";
export const DOC_MUTED = "#5a6478";
export const DOC_RULE = "#d9e2ef";

export function Letterhead({
  company,
  docLabel,
  badge,
}: {
  company: CompanyProfile;
  /** QUOTATION, TAX INVOICE, BILL OF SUPPLY, DELIVERY CHALLAN */
  docLabel: string;
  badge?: string;
}) {
  return (
    <>
      <div className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-wide">
        <span className="flex items-center gap-2">
          {docLabel}
          {badge && (
            <span className="rounded border px-1.5 py-0.5 text-[10px]" style={{ borderColor: DOC_MUTED }}>
              {badge}
            </span>
          )}
        </span>
        <span style={{ color: DOC_MUTED }}>{company.tagline}</span>
      </div>

      <div className="mt-2 flex items-start gap-4 print:mt-1 print:gap-3">
        <Image
          src="/brand/sl-logo.png"
          alt=""
          width={72}
          height={72}
          className="size-16 shrink-0 object-contain print:size-12"
        />
        <div className="min-w-0 flex-1">
          <p
            className="font-heading text-xl font-bold leading-tight sm:text-2xl print:text-lg"
            style={{ color: DOC_BLUE }}
          >
            {company.name}
          </p>
          <p className="mt-1 text-[11px] leading-snug">{company.address}</p>
          <p className="mt-1 text-[11px] leading-snug">
            <b>Mobile:</b> {company.phone}
            {company.altPhone ? `, ${company.altPhone}` : ""}
            {company.gstin && (
              <>
                {"   "}
                <b>GSTIN:</b> {company.gstin}
              </>
            )}
            {company.pan && (
              <>
                {"   "}
                <b>PAN Number:</b> {company.pan}
              </>
            )}
          </p>
          <p className="text-[11px] leading-snug">
            <b>Email:</b> {company.email}
            {"   "}
            <b>Website:</b> {company.website}
          </p>
        </div>
      </div>

      <div className="mt-3 h-[3px] w-full print:mt-2" style={{ backgroundColor: DOC_BLUE }} />
    </>
  );
}

/**
 * Bank block and the UPI QR, as the owner's samples lay them out. The QR leaves
 * the amount open for the payer to type, so the amount due is printed beside it.
 */
export function BankBlock({
  company,
  qrSvg,
  amount,
  amountLabel = "Amount due",
}: {
  company: CompanyProfile;
  qrSvg: string | null;
  /** Paise still owed on this document. */
  amount?: number;
  /** A quotation is not a demand for payment, so it says what the total is instead. */
  amountLabel?: string;
}) {
  if (!company.bankAccountNo && !company.upiId) return null;
  return (
    <div className="text-[11px] leading-snug">
      {company.bankAccountNo && (
        <>
          <p className="mb-1 font-bold uppercase">Bank Details</p>
          <table className="border-collapse">
            <tbody>
              <tr>
                <td className="pr-3 align-top" style={{ color: DOC_MUTED }}>
                  Name:
                </td>
                <td className="align-top">{company.bankName}</td>
              </tr>
              <tr>
                <td className="pr-3 align-top" style={{ color: DOC_MUTED }}>
                  IFSC Code:
                </td>
                <td className="align-top">{company.bankIfsc}</td>
              </tr>
              <tr>
                <td className="pr-3 align-top" style={{ color: DOC_MUTED }}>
                  Account No:
                </td>
                <td className="align-top">{company.bankAccountNo}</td>
              </tr>
              <tr>
                <td className="pr-3 align-top" style={{ color: DOC_MUTED }}>
                  Bank:
                </td>
                <td className="align-top">{company.bankBranch}</td>
              </tr>
            </tbody>
          </table>
        </>
      )}

      {company.upiId && qrSvg && (
        <div className="mt-3 print:mt-2">
          <p className="mb-1 font-bold uppercase">Payment QR Code</p>
          <div className="flex items-center gap-3">
            <span
              className="block size-24 shrink-0 [&>svg]:size-full print:size-20"
              dangerouslySetInnerHTML={{ __html: qrSvg }}
            />
            <span>
              <span className="block" style={{ color: DOC_MUTED }}>
                UPI ID:
              </span>
              {company.upiId}
              {amount ? (
                <span className="mt-1 block font-bold">{amountLabel}: {formatINR(amount)}</span>
              ) : null}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

/** The terms in small type, under the totals, so they take no row of their own. */
export function TermsBlock({ terms }: { terms: string | null }) {
  const lines = (terms ?? "")
    .split("\n")
    .map((t) => t.trim())
    .filter(Boolean);
  if (lines.length === 0) return null;
  return (
    <div className="mt-3 text-[10px] leading-snug print:mt-2">
      <p className="mb-0.5 font-bold uppercase">Terms and Conditions</p>
      <ol className="list-inside list-decimal">
        {lines.map((t, i) => (
          <li key={i}>{t}</li>
        ))}
      </ol>
    </div>
  );
}

/**
 * The last row: the receiver's box on the left, the embedded signature on the
 * right. It never breaks across pages, so the signature cannot end up alone on
 * a second sheet.
 */
export function SignatureBlock({
  company,
  receiverNote,
}: {
  company: CompanyProfile;
  /** A line above the receiver's box, such as the challan's goods received. */
  receiverNote?: string;
}) {
  return (
    <div className="mt-5 flex break-inside-avoid flex-wrap items-end justify-between gap-6 text-[11px] print:mt-3">
      <div>
        {receiverNote && <p className="mb-1 font-semibold">{receiverNote}</p>}
        <div className="h-[15mm] w-56 border" style={{ borderColor: DOC_NAVY }} aria-hidden />
        <p className="mt-1 font-bold">Receiver&apos;s Signature</p>
      </div>
      <div className="text-right">
        {company.signature ? (
          // eslint-disable-next-line @next/next/no-img-element -- a data URI, not a file to optimise
          <img
            src={company.signature}
            alt=""
            className="ml-auto h-16 w-auto object-contain print:h-12"
          />
        ) : (
          <span className="block h-16 print:h-12" />
        )}
        <p className="font-bold uppercase">Authorised signatory for</p>
        <p className="uppercase">{company.name}</p>
      </div>
    </div>
  );
}
