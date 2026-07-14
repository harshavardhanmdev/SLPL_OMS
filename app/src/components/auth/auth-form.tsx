"use client";

import * as React from "react";
import Link from "next/link";
import { useActionState } from "react";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { AuthFormState } from "@/lib/auth-actions";

type Mode = "login" | "signup";

export function AuthForm({
  mode,
  action,
  next,
}: {
  mode: Mode;
  action: (prev: AuthFormState, formData: FormData) => Promise<AuthFormState>;
  next?: string;
}) {
  const [state, formAction, pending] = useActionState(action, {});

  return (
    <form action={formAction} className="space-y-4">
      {next && <input type="hidden" name="next" value={next} />}

      {mode === "signup" && (
        <>
          <div className="space-y-1.5">
            <Label htmlFor="name">Full name</Label>
            <Input id="name" name="name" autoComplete="name" required placeholder="Your name" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="phone">
              Mobile number <span className="text-muted-foreground">(optional)</span>
            </Label>
            <Input
              id="phone"
              name="phone"
              inputMode="numeric"
              autoComplete="tel-national"
              maxLength={10}
              placeholder="10-digit mobile"
            />
          </div>
        </>
      )}

      <div className="space-y-1.5">
        <Label htmlFor="email">Email</Label>
        <Input id="email" name="email" type="email" autoComplete="email" required placeholder="you@example.com" />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          name="password"
          type="password"
          required
          minLength={mode === "signup" ? 8 : 1}
          autoComplete={mode === "signup" ? "new-password" : "current-password"}
          placeholder={mode === "signup" ? "At least 8 characters" : "Your password"}
        />
      </div>

      {state.error && (
        <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-sm font-medium text-destructive">
          {state.error}
        </p>
      )}

      <Button type="submit" size="lg" className="w-full gap-2" disabled={pending}>
        {pending && <Loader2 className="size-4 animate-spin" />}
        {mode === "login" ? "Log in" : "Create account"}
      </Button>

      <p className="text-center text-sm text-muted-foreground">
        {mode === "login" ? (
          <>
            New to SLPL Store?{" "}
            <Link
              href={next ? `/signup?next=${encodeURIComponent(next)}` : "/signup"}
              className="font-medium text-foreground underline"
            >
              Create an account
            </Link>
          </>
        ) : (
          <>
            Already have an account?{" "}
            <Link
              href={next ? `/login?next=${encodeURIComponent(next)}` : "/login"}
              className="font-medium text-foreground underline"
            >
              Log in
            </Link>
          </>
        )}
      </p>
    </form>
  );
}
