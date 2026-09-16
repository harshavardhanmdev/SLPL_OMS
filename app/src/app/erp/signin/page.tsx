export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Image from "next/image";

import { StaffSignInForm } from "@/components/erp/staff-signin-form";
import { getStaff } from "@/lib/staff-auth";

export const metadata: Metadata = { title: "Staff sign in", robots: { index: false } };

export default async function StaffSignInPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  const safeNext = next && /^\/[^/\\]/.test(next) ? next : "/erp";
  if (await getStaff()) redirect(safeNext);

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-secondary via-background to-accent/40 px-4 dark:from-card dark:via-background dark:to-card">
      <div className="w-full max-w-sm rounded-2xl border bg-card p-8 shadow-lg">
        <div className="mb-6 flex flex-col items-center gap-2 text-center">
          <Image
            src="/brand/sl-logo.png"
            alt=""
            width={48}
            height={48}
            className="size-12 rounded-xl bg-white object-contain p-1 ring-1 ring-border"
          />
          <h1 className="font-heading text-xl font-bold">SLPL Back office</h1>
          <p className="text-sm text-muted-foreground">Sign in with your own account.</p>
        </div>
        <StaffSignInForm next={safeNext} />
      </div>
    </div>
  );
}
