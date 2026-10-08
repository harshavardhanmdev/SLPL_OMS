export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { FingerprintOffer } from "@/components/erp/passkey-controls";
import { getStaff } from "@/lib/staff-auth";
import { safeRelativePath } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Fingerprint sign-in",
  robots: { index: false },
  manifest: "/erp.webmanifest",
};

/** The one question asked after a password sign-in on a phone that can use a fingerprint. */
export default async function FingerprintOfferPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  const safeNext = safeRelativePath(next, "/erp");
  const staff = await getStaff();
  if (!staff || staff.breakGlass) redirect(safeNext);

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-secondary via-background to-accent/40 px-4 dark:from-card dark:via-background dark:to-card">
      <div className="w-full max-w-sm rounded-2xl border bg-card p-8 shadow-lg">
        <FingerprintOffer next={safeNext} />
      </div>
    </div>
  );
}
