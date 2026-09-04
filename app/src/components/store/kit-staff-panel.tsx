"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { LogOut, Loader2, Search } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  lookupReceipt,
  schoolStaffLogin,
  schoolStaffLogout,
  type LookupResult,
} from "@/lib/kit-staff-actions";
import type { StaffSession } from "@/lib/kit-staff-auth";

/**
 * Sign-in plus manual receipt lookup. Scanning the QR is the normal path: it
 * opens the receipt page, which shows the handover button to signed-in staff.
 */
export function KitStaffPanel({
  staff,
  counts,
}: {
  staff: StaffSession | null;
  counts: { awaiting: number; collected: number };
}) {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);
  const [code, setCode] = React.useState("");
  const [pin, setPin] = React.useState("");
  const [staffName, setStaffName] = React.useState("");
  const [receipt, setReceipt] = React.useState("");
  const [found, setFound] = React.useState<LookupResult["purchase"] | null>(null);

  async function signIn(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await schoolStaffLogin({ code, pin, staffName });
      if (res.error) toast.error(res.error);
      else {
        toast.success("Signed in.");
        router.refresh();
      }
    } finally {
      setBusy(false);
    }
  }

  async function lookup(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setFound(null);
    try {
      const res = await lookupReceipt(receipt);
      if (res.error) toast.error(res.error);
      else if (res.purchase) setFound(res.purchase);
    } finally {
      setBusy(false);
    }
  }

  if (!staff) {
    return (
      <form onSubmit={signIn} className="space-y-4 rounded-2xl border bg-card p-5">
        <div>
          <Label htmlFor="school-code">School code</Label>
          <Input
            id="school-code"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="Given to you by SLPL"
            autoCapitalize="characters"
          />
        </div>
        <div>
          <Label htmlFor="school-pin">PIN</Label>
          <Input
            id="school-pin"
            type="password"
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            inputMode="numeric"
          />
        </div>
        <div>
          <Label htmlFor="staff-name">Your name</Label>
          <Input
            id="staff-name"
            value={staffName}
            onChange={(e) => setStaffName(e.target.value)}
            placeholder="Recorded against every handover"
          />
        </div>
        <Button type="submit" disabled={busy} className="w-full gap-2">
          {busy && <Loader2 className="size-4 animate-spin" />} Sign in
        </Button>
        <p className="text-xs text-muted-foreground">
          Do not have a code and PIN? Ask SLPL to set one up for your school.
        </p>
      </form>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border bg-card p-4">
        <div className="text-sm">
          <p className="font-heading font-semibold">{staff.schoolName}</p>
          <p className="text-muted-foreground">Signed in as {staff.staffName}</p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="gap-2"
          onClick={async () => {
            await schoolStaffLogout();
            router.refresh();
          }}
        >
          <LogOut className="size-4" /> Sign out
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-2xl border bg-card p-4 text-center">
          <p className="font-heading text-2xl font-bold">{counts.awaiting}</p>
          <p className="text-xs text-muted-foreground">Awaiting collection</p>
        </div>
        <div className="rounded-2xl border bg-card p-4 text-center">
          <p className="font-heading text-2xl font-bold">{counts.collected}</p>
          <p className="text-xs text-muted-foreground">Collected</p>
        </div>
      </div>

      <form onSubmit={lookup} className="rounded-2xl border bg-card p-5">
        <Label htmlFor="receipt-number">Receipt number</Label>
        <div className="mt-1 flex gap-2">
          <Input
            id="receipt-number"
            value={receipt}
            onChange={(e) => setReceipt(e.target.value.toUpperCase())}
            placeholder="SLPL-K-2609-A1B2C"
            autoCapitalize="characters"
          />
          <Button type="submit" disabled={busy} className="shrink-0 gap-2">
            {busy ? <Loader2 className="size-4 animate-spin" /> : <Search className="size-4" />}
            Find
          </Button>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          Normally you just scan the QR code on the family&apos;s receipt with your phone camera.
        </p>
      </form>

      {found && (
        <div className="rounded-2xl border bg-card p-5">
          <p className="font-heading text-lg font-semibold">{found.studentName}</p>
          <p className="text-sm text-muted-foreground">
            {found.classLabel} {found.section}
            {found.rollNumber ? ` · Roll ${found.rollNumber}` : ""} · {found.kitTitle}
          </p>
          <p className="mt-2 text-sm">
            Status: <b>{found.status}</b>
            {found.collectedAt &&
              ` on ${new Date(found.collectedAt).toLocaleString("en-IN", {
                day: "numeric",
                month: "short",
                hour: "numeric",
                minute: "2-digit",
              })}`}
            {found.collectedBy && ` by ${found.collectedBy}`}
          </p>
          <Button variant="outline" className="mt-3" asChild>
            <Link href={`/kits/receipt/${found.accessToken}`}>Open the receipt</Link>
          </Button>
        </div>
      )}
    </div>
  );
}
