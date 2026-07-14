import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { AuthForm } from "@/components/auth/auth-form";
import { getSession } from "@/lib/auth";
import { signupAction } from "@/lib/auth-actions";

export const metadata: Metadata = { title: "Create account" };

type Props = { searchParams: Promise<{ next?: string }> };

export default async function SignupPage({ searchParams }: Props) {
  const { next } = await searchParams;
  if (await getSession()) redirect(next?.startsWith("/") ? next : "/account");

  return (
    <div className="mx-auto max-w-md px-4 py-16">
      <h1 className="mb-1 font-heading text-3xl font-bold">Create your account</h1>
      <p className="mb-8 text-muted-foreground">
        One account for orders, tracking and faster checkout.
      </p>
      <AuthForm mode="signup" action={signupAction} next={next} />
    </div>
  );
}
