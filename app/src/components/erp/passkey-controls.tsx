"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Fingerprint, Loader2, Trash2 } from "lucide-react";
import { platformAuthenticatorIsAvailable, startRegistration } from "@simplewebauthn/browser";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { passkeyRegister, passkeyRegisterOptions, removePasskey } from "@/lib/passkey-actions";

/** Whether this phone was set up ("set") or the person said not now ("no"). */
const KEY = "slpl-passkey";

export function recallPasskey(): string | null {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export function rememberPasskey(value: "set" | "no") {
  try {
    localStorage.setItem(KEY, value);
  } catch {
    // a private window keeps nothing, which only means being asked again
  }
}

/** Asks the phone for a fingerprint or face and saves the passkey it makes. */
export async function setUpPasskey(): Promise<{ ok?: boolean; error?: string }> {
  const { options, error } = await passkeyRegisterOptions();
  if (!options) return { error };
  let response;
  try {
    response = await startRegistration({ optionsJSON: options });
  } catch (e) {
    // Already set up on this phone, perhaps synced from another of theirs
    if (e instanceof Error && e.name === "InvalidStateError") {
      rememberPasskey("set");
      return { ok: true };
    }
    return { error: "Cancelled. You can set it up later from the menu, under Fingerprint sign-in." };
  }
  const res = await passkeyRegister(response);
  if (res.ok) rememberPasskey("set");
  return res;
}

/** Whether this phone can unlock with a fingerprint or face at all. */
export function usePlatformAuthenticator(): boolean {
  const [able, setAble] = React.useState(false);
  React.useEffect(() => {
    let live = true;
    void platformAuthenticatorIsAvailable()
      .catch(() => false)
      .then((yes) => {
        if (live) setAble(yes);
      });
    return () => {
      live = false;
    };
  }, []);
  return able;
}

type Passkey = { id: string; deviceName: string; createdAt: string; lastUsedAt: string | null };

/** The person's own phones that sign in with a fingerprint or face, and adding this one. */
export function PasskeyManager({ passkeys }: { passkeys: Passkey[] }) {
  const router = useRouter();
  const able = usePlatformAuthenticator();
  const [busy, setBusy] = React.useState<string | null>(null);

  async function add() {
    setBusy("add");
    try {
      const res = await setUpPasskey();
      if (res.error) toast.error(res.error);
      else {
        toast.success("Done. Next time, sign in with your fingerprint or face.");
        router.refresh();
      }
    } finally {
      setBusy(null);
    }
  }

  async function remove(id: string) {
    if (!window.confirm("Stop fingerprint sign-in on that device?")) return;
    setBusy(id);
    try {
      const res = await removePasskey(id);
      if (res.error) toast.error(res.error);
      else router.refresh();
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-5">
      <section className="space-y-3 rounded-2xl border bg-card p-4 sm:p-5">
        <p className="text-sm text-muted-foreground">
          Sign in with the fingerprint or face that already unlocks your phone, instead of typing your
          password. Your fingerprint stays on your phone; we never see it.
        </p>
        {able ? (
          <Button className="gap-2" disabled={busy !== null} onClick={() => void add()}>
            {busy === "add" ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Fingerprint className="size-4" />
            )}
            Set up on this phone
          </Button>
        ) : (
          <p className="text-sm text-muted-foreground">
            This device has no fingerprint or face unlock set up. Open this page on your phone to add it
            there.
          </p>
        )}
      </section>

      <section className="rounded-2xl border bg-card">
        <h2 className="border-b p-4 font-heading font-semibold">Your phones</h2>
        {passkeys.length === 0 ? (
          <p className="p-6 text-center text-sm text-muted-foreground">None set up yet.</p>
        ) : (
          <ul className="divide-y">
            {passkeys.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 p-4">
                <div>
                  <p className="font-medium">{p.deviceName}</p>
                  <p className="text-xs text-muted-foreground">
                    Added {p.createdAt}
                    {p.lastUsedAt ? ` · last used ${p.lastUsedAt}` : ""}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  className="gap-1.5"
                  disabled={busy !== null}
                  onClick={() => void remove(p.id)}
                >
                  {busy === p.id ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <Trash2 className="size-3.5" />
                  )}
                  Remove
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

/** Straight after a password sign-in: fingerprint or face next time, or not now. */
export function FingerprintOffer({ next }: { next: string }) {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);

  function go() {
    router.replace(next);
  }

  async function accept() {
    setBusy(true);
    const res = await setUpPasskey();
    if (res.error) toast.error(res.error);
    else toast.success("Done. Next time, sign in with your fingerprint or face.");
    go();
  }

  return (
    <div className="space-y-4 text-center">
      <Fingerprint className="mx-auto size-10 text-saffron-deep" />
      <h1 className="font-heading text-lg font-semibold">Use your fingerprint or face next time?</h1>
      <p className="text-sm text-muted-foreground">
        Sign in with the touch or look that already unlocks this phone. It stays on your phone; we never see
        it.
      </p>
      <Button size="lg" className="w-full gap-2" disabled={busy} onClick={() => void accept()}>
        {busy ? <Loader2 className="size-4 animate-spin" /> : <Fingerprint className="size-4" />}
        Set it up
      </Button>
      <Button
        variant="ghost"
        className="w-full"
        disabled={busy}
        onClick={() => {
          rememberPasskey("no");
          go();
        }}
      >
        Not now
      </Button>
    </div>
  );
}
