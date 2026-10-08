"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Fingerprint, Loader2, LogIn } from "lucide-react";
import { browserSupportsWebAuthn, startAuthentication } from "@simplewebauthn/browser";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import { recallPasskey, usePlatformAuthenticator } from "@/components/erp/passkey-controls";
import { passkeySignIn, passkeySignInOptions } from "@/lib/passkey-actions";
import { staffSignIn } from "@/lib/staff-actions";

/**
 * Email and password, or a fingerprint or face on a phone set up for it.
 * A trusted phone stays signed in for 60 days. After a password sign-in on a
 * phone that can, /erp/fingerprint offers fingerprint sign-in for next time, once.
 */
export function StaffSignInForm({ next }: { next: string }) {
  const router = useRouter();
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [trusted, setTrusted] = React.useState(true);
  const [busy, setBusy] = React.useState(false);
  const able = usePlatformAuthenticator();
  // Read after the first paint, so the server and the browser draw the same form
  const setUp = React.useSyncExternalStore(
    () => () => {},
    () => browserSupportsWebAuthn() && recallPasskey() === "set",
    () => false,
  );

  function go() {
    router.replace(next);
    router.refresh();
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      // A phone that can use a fingerprint, and has not been asked, is asked once
      const destination =
        able && !recallPasskey() ? `/erp/fingerprint?next=${encodeURIComponent(next)}` : next;
      const res = await staffSignIn(email, password, trusted, destination);
      if (res?.error) toast.error(res.error);
    } finally {
      setBusy(false);
    }
  }

  async function withFingerprint() {
    setBusy(true);
    try {
      const { options } = await passkeySignInOptions();
      if (!options) return;
      let response;
      try {
        response = await startAuthentication({ optionsJSON: options });
      } catch {
        toast.error("Cancelled. Sign in with your password instead.");
        return;
      }
      const res = await passkeySignIn(response);
      if (res.error) {
        toast.error(res.error);
        return;
      }
      go();
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      {setUp && (
        <>
          <Button
            type="button"
            size="lg"
            className="w-full gap-2"
            disabled={busy}
            onClick={() => void withFingerprint()}
          >
            <Fingerprint className="size-4" /> Sign in with fingerprint or face
          </Button>
          <p className="text-center text-xs text-muted-foreground">or with your password</p>
        </>
      )}
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
        <PasswordInput
          id="staff-password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="h-11"
          required
        />
      </div>
      <label className="flex items-start gap-2.5 text-sm">
        <input
          id="staff-trusted"
          type="checkbox"
          checked={trusted}
          onChange={(e) => setTrusted(e.target.checked)}
          className="mt-0.5 size-4 accent-[var(--navy)]"
        />
        <span>
          Trust this phone
          <span className="block text-xs text-muted-foreground">
            Stay signed in for 60 days. Untick on a shared computer.
          </span>
        </span>
      </label>
      <Button
        type="submit"
        size="lg"
        variant={setUp ? "outline" : "default"}
        className="w-full gap-2"
        disabled={busy}
      >
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
