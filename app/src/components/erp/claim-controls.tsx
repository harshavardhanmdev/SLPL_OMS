"use client";

import * as React from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Camera, Check, Loader2, Send } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { decideClaim, submitClaim, withdrawClaim } from "@/lib/claim-actions";
import { CLAIM_CATEGORIES, type ClaimCategory } from "@/lib/claims";
import { todayLocalIso } from "@/lib/utils";

const selectClass =
  "flex h-11 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50";

/** A new claim: what, when, how much, and the bill if there is one. */
export function ClaimForm() {
  const router = useRouter();
  const blank = {
    spentOn: todayLocalIso(),
    category: "TRAVEL" as ClaimCategory,
    amount: "",
    note: "",
  };
  const [v, setV] = React.useState(blank);
  const [billImage, setBillImage] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [uploading, setUploading] = React.useState(false);
  const fileRef = React.useRef<HTMLInputElement>(null);

  async function upload(file: File) {
    setUploading(true);
    try {
      const form = new FormData();
      form.set("file", file);
      // "receipt" keeps the bill to staff only
      form.set("kind", "receipt");
      const res = await fetch("/api/admin/upload", {
        method: "POST",
        body: form,
      });
      const data = (await res.json()) as { url?: string; error?: string };
      if (!res.ok || !data.url) {
        toast.error(data.error ?? "Could not upload that photo.");
        return;
      }
      setBillImage(data.url);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await submitClaim({
        ...v,
        amount: Number(v.amount) || 0,
        billImage,
      });
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success("Sent for approval.");
      setV(blank);
      setBillImage(null);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3 rounded-2xl border bg-card p-4 sm:p-5">
      <h2 className="font-heading font-semibold">Claim an expense</h2>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="space-y-1.5">
          <Label htmlFor="cl-cat">What for</Label>
          <select
            id="cl-cat"
            className={selectClass}
            value={v.category}
            onChange={(e) => setV((o) => ({ ...o, category: e.target.value as ClaimCategory }))}
          >
            {CLAIM_CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="cl-amount">Amount, rupees</Label>
          <Input
            id="cl-amount"
            inputMode="decimal"
            value={v.amount}
            onChange={(e) =>
              setV((o) => ({
                ...o,
                amount: e.target.value.replace(/[^\d.]/g, ""),
              }))
            }
            className="h-11"
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="cl-date">Date</Label>
          <Input
            id="cl-date"
            type="date"
            value={v.spentOn}
            max={todayLocalIso()}
            onChange={(e) => setV((o) => ({ ...o, spentOn: e.target.value }))}
            className="h-11"
            required
          />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="cl-note">Where and why</Label>
        <Input
          id="cl-note"
          value={v.note}
          onChange={(e) => setV((o) => ({ ...o, note: e.target.value }))}
          placeholder="Auto to Uppal and back, Sunrise High School visit"
          className="h-11"
          required
        />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void upload(f);
          }}
        />
        {billImage ? (
          <>
            <Image
              src={billImage}
              alt="Bill"
              width={44}
              height={58}
              className="h-14 w-11 rounded-md border object-cover"
            />
            <Button type="button" variant="outline" onClick={() => setBillImage(null)}>
              Remove the photo
            </Button>
          </>
        ) : (
          <Button
            type="button"
            variant="outline"
            className="gap-2"
            disabled={uploading}
            onClick={() => fileRef.current?.click()}
          >
            {uploading ? <Loader2 className="size-4 animate-spin" /> : <Camera className="size-4" />}
            Add a photo of the bill
          </Button>
        )}
        <Button type="submit" className="ml-auto gap-2" disabled={busy || uploading}>
          {busy ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
          Send for approval
        </Button>
      </div>
    </form>
  );
}

/** The owner's call: approve, or send back with a reason the person will see. */
export function ClaimDecision({ id, title }: { id: string; title: string }) {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);
  const [asking, setAsking] = React.useState(false);
  const [reason, setReason] = React.useState("");

  function run(decision: "APPROVED" | "REJECTED", why?: string) {
    setBusy(true);
    void decideClaim({ id, decision, reason: why })
      .then((res) => {
        if (res.error) toast.error(res.error);
        else {
          toast.success(decision === "APPROVED" ? "Approved." : "Sent back.");
          setAsking(false);
          setReason("");
          router.refresh();
        }
      })
      .finally(() => setBusy(false));
  }

  if (asking) {
    return (
      <div className="flex flex-wrap items-center gap-1.5">
        <Input
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Why is it going back?"
          className="h-9 w-56"
          aria-label={`Reason for sending back ${title}`}
        />
        <Button size="sm" variant="destructive" disabled={busy} onClick={() => run("REJECTED", reason)}>
          {busy ? <Loader2 className="size-3.5 animate-spin" /> : "Send back"}
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setAsking(false)}>
          Cancel
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap gap-1.5">
      <Button size="sm" className="gap-1.5" disabled={busy} onClick={() => run("APPROVED")}>
        {busy ? <Loader2 className="size-3.5 animate-spin" /> : <Check className="size-3.5" />}
        Approve
      </Button>
      <Button size="sm" variant="outline" disabled={busy} onClick={() => setAsking(true)}>
        Send back
      </Button>
    </div>
  );
}

/** Takes back a claim that is waiting or was sent back. */
export function WithdrawClaim({ id }: { id: string }) {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);
  return (
    <Button
      size="sm"
      variant="ghost"
      disabled={busy}
      onClick={() => {
        if (!window.confirm("Take back this claim?")) return;
        setBusy(true);
        void withdrawClaim(id)
          .then((res) => {
            if (res.error) toast.error(res.error);
            else router.refresh();
          })
          .finally(() => setBusy(false));
      }}
    >
      {busy ? <Loader2 className="size-3.5 animate-spin" /> : "Take back"}
    </Button>
  );
}
