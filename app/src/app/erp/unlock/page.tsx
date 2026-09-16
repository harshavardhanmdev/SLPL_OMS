export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { PinPad } from "@/components/erp/pin-pad";
import { isAdmin } from "@/lib/admin-auth";
import { hasPin, isRememberedDevice } from "@/lib/expense-pin";

export const metadata: Metadata = { title: "Unlock", robots: { index: false } };

export default async function UnlockPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  const safeNext = next && /^\/[^/\\]/.test(next) ? next : "/erp/expenses";

  if (await isAdmin()) redirect(safeNext);
  // No trusted device or no PIN set means the password is the only way in
  if (!(await isRememberedDevice()) || !(await hasPin())) {
    redirect(`/admin/login?next=${encodeURIComponent(safeNext)}`);
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-secondary via-background to-accent/40 px-4 dark:from-card dark:via-background dark:to-card">
      <PinPad next={safeNext} />
    </div>
  );
}
