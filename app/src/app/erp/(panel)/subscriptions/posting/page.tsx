export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";

import { PrintButton } from "@/components/store/print-button";
import { db } from "@/lib/db";
import { site } from "@/lib/site";
import { issueLabelFor } from "@/lib/subscription-plans";

export const metadata: Metadata = { title: "Posting list", robots: { index: false } };

const NAVY = "#1E2A5A";
const SAFFRON = "#F5A623";

/**
 * Address labels for one issue, cut and pasted onto the envelopes.
 *
 * Colours are literal hex rather than theme tokens, because this page is
 * printed and must not follow the reader's dark mode.
 */
export default async function PostingListPage({
  searchParams,
}: {
  searchParams: Promise<{ issue?: string }>;
}) {
  const { issue: raw } = await searchParams;
  const issue = raw?.trim() || issueLabelFor();

  const due = await db.subscription.findMany({
    where: { status: "ACTIVE", dispatches: { none: { issueLabel: issue } } },
    orderBy: [{ state: "asc" }, { city: "asc" }, { pincode: "asc" }],
  });
  const owed = due.filter((s) => s.issuesSent < s.issuesTotal);

  return (
    <div className="mx-auto max-w-5xl">
      <style>{"@media print { @page { size: A4; margin: 10mm; } }"}</style>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Link
          href="/erp/subscriptions"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="size-4" /> Back to subscriptions
        </Link>
        <PrintButton />
      </div>

      <div className="bg-white p-6 text-black" style={{ color: NAVY }}>
        <header
          className="mb-5 flex items-center gap-3 border-b-2 pb-3"
          style={{ borderColor: SAFFRON }}
        >
          <Image
            src="/brand/sl-logo.png"
            alt=""
            width={44}
            height={44}
            className="size-11 object-contain"
          />
          <div>
            <p className="font-heading text-lg font-bold">{site.company}</p>
            <p className="text-sm">
              The GenZ Times, posting list for {issue} · {owed.length}{" "}
              {owed.length === 1 ? "envelope" : "envelopes"}
            </p>
          </div>
        </header>

        {owed.length === 0 ? (
          <p className="py-10 text-center text-sm">
            Nobody is owed the {issue} issue. Every active subscriber has already been recorded.
          </p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {owed.map((s) => (
              <div
                key={s.id}
                className="break-inside-avoid rounded border p-3 text-sm"
                style={{ borderColor: NAVY }}
              >
                <p className="font-semibold">{s.subscriberName}</p>
                <p>{s.addressLine1}</p>
                {s.addressLine2 && <p>{s.addressLine2}</p>}
                <p>
                  {s.city}, {s.state}
                </p>
                <p className="font-semibold">{s.pincode}</p>
                <p className="mt-1.5 text-xs" style={{ color: "#5a6478" }}>
                  {s.phone} · {s.code} · issue {s.issuesSent + 1} of {s.issuesTotal}
                </p>
              </div>
            ))}
          </div>
        )}

        <p className="mt-6 border-t pt-3 text-xs" style={{ borderColor: "#e3e8f2" }}>
          Printed {new Date().toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}.
          Record the run in the back office once these are in the post, so the count of issues sent
          stays true.
        </p>
      </div>
    </div>
  );
}
