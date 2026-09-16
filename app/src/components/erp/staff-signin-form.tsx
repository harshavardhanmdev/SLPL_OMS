"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2, LogIn } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { staffSignIn } from "@/lib/staff-actions";

export function StaffSignInForm({ next }: { next: string }) {
  const router = useRouter();
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await staffSignIn(email, password);
      if (res.error) {
        toast.error(res.error);
        return;
      }
      router.replace(next);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="staff-email">Email</Label>
        <Input
          id="staff-email"
          type="email"
          autoComplete="username"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="h-11"
          required
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="staff-password">Password</Label>
        <Input
          id="staff-password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="h-11"
          required
        />
      </div>
      <Button type="submit" size="lg" className="w-full gap-2" disabled={busy}>
        {busy ? <Loader2 className="size-4 animate-spin" /> : <LogIn className="size-4" />}
        Sign in
      </Button>
      <p className="text-center text-sm">
        <Link href="/admin/login?next=/erp" className="text-muted-foreground hover:underline">
          Owner break-glass login
        </Link>
      </p>
    </form>
  );
}
