import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { AuthForm } from "@/components/auth/auth-form";
import { getSession } from "@/lib/auth";
import { loginAction } from "@/lib/auth-actions";

export const metadata: Metadata = { title: "Log in" };

type Props = { searchParams: Promise<{ next?: string }> };

export default async function LoginPage({ searchParams }: Props) {
  const { next } = await searchParams;
  if (await getSession()) redirect(next?.startsWith("/") ? next : "/account");

  return (
    <div className="mx-auto max-w-md px-4 py-16">
      <h1 className="mb-1 font-heading text-3xl font-bold">Welcome back</h1>
      <p className="mb-8 text-muted-foreground">Log in to track orders and check out faster.</p>
      <AuthForm mode="login" action={loginAction} next={next} />
    </div>
  );
}
