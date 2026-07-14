"use client";

import { useActionState } from "react";
import { Loader2, LockKeyhole } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { adminLogin } from "@/lib/admin-actions";

export function AdminLoginForm() {
  const [state, formAction, pending] = useActionState(adminLogin, {});

  return (
    <form action={formAction} className="space-y-4">
      <Input
        type="password"
        name="password"
        required
        autoFocus
        placeholder="Admin password"
        autoComplete="current-password"
      />
      {state.error && (
        <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-sm font-medium text-destructive">
          {state.error}
        </p>
      )}
      <Button type="submit" size="lg" className="w-full gap-2" disabled={pending}>
        {pending ? <Loader2 className="size-4 animate-spin" /> : <LockKeyhole className="size-4" />}
        Enter admin panel
      </Button>
    </form>
  );
}
