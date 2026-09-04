"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { KeyRound, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { setSchoolPin } from "@/lib/kit-admin-actions";

export function SchoolPinPanel({ schoolId, hasPin }: { schoolId: string; hasPin: boolean }) {
  const router = useRouter();
  const [pin, setPin] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await setSchoolPin(schoolId, pin);
      if (res.error) toast.error(res.error);
      else {
        toast.success("PIN set. Pass it to the school now, it cannot be read back.");
        setPin("");
        router.refresh();
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={save} className="space-y-3">
      <p className="flex items-center gap-2 text-sm">
        <KeyRound className="size-4 text-saffron-deep" />
        {hasPin ? "A PIN is set." : "No PIN set yet."}
      </p>
      <Input
        value={pin}
        onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 8))}
        placeholder="4 to 8 digits"
        inputMode="numeric"
      />
      <Button type="submit" disabled={busy || pin.length < 4} className="w-full gap-2">
        {busy && <Loader2 className="size-4 animate-spin" />}
        {hasPin ? "Replace the PIN" : "Set the PIN"}
      </Button>
      <p className="text-xs text-muted-foreground">
        Stored hashed, exactly like the admin password. Write it down before you save.
      </p>
    </form>
  );
}
