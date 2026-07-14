import type { Metadata } from "next";
import Image from "next/image";
import { redirect } from "next/navigation";

import { isAdmin } from "@/lib/admin-auth";
import { AdminLoginForm } from "@/components/admin/admin-login-form";

export const metadata: Metadata = { title: "Admin login", robots: { index: false } };

export default async function AdminLoginPage() {
  if (await isAdmin()) redirect("/admin");

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
          <h1 className="font-heading text-xl font-bold">SLPL Store Admin</h1>
          <p className="text-sm text-muted-foreground">Enter the store password to continue.</p>
        </div>
        <AdminLoginForm />
      </div>
    </div>
  );
}
