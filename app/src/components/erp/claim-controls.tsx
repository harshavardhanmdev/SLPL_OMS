"use client";

import * as React from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Camera, Check, Loader2, Plus, Send, Trash2, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { decideClaim, submitClaim, withdrawClaim } from "@/lib/claim-actions";
import { CLAIM_CATEGORIES, PAYMENT_MODES, type ClaimCategory } from "@/lib/claims";
import { formatINR } from "@/lib/money";
import { todayLocalIso } from "@/lib/utils";

const selectClass =
  "flex h-11 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50";

type Line = { category: ClaimCategory; amount: string; description: string };
const blankLine = (): Line => ({ category: "TRAVEL", amount: "", description: "" });

/**
 * A day's spending in one claim: every expense as a line (auto 120, lunch 250,
 * hotel 1,200), one total, and as many photos of the bills as there are.
 */
export function ClaimForm() {
  const router = useRouter();
  const blank = {
    spentOn: todayLocalIso(),
    paymentMode: "CASH",
    note: "",
  };
  const [v, setV] = React.useState(blank);
  const [lines, setLines] = React.useState<Line[]>([blankLine()]);
  const [photos, setPhotos] = React.useState<string[]>([]);
  const [busy, setBusy] = React.useState(false);
  const [uploading, setUploading] = React.useState(0);
  const fileRef = React.useRef<HTMLInputElement>(null);

  const setLine = (i: number, patch: Partial<Line>) =>
    setLines((old) => old.map((l, j) => (j === i ? { ...l, ...patch } : l)));
  const total = lines.reduce((sum, l) => sum + (Number(l.amount) || 0), 0);

  async function upload(files: File[]) {
    const room = 10 - photos.length;
    if (files.length > room) toast.error(room > 0 ? `Only ${room} more photo${room === 1 ? "" : "s"} fit.` : "Up to 10 photos.");
    for (const file of files.slice(0, Math.max(0, room))) {
      setUploading((n) => n + 1);
      try {
        const form = new FormData();
        form.set("file", file);
        // "receipt" keeps the bill to staff only
        form.set("kind", "receipt");
        const res = await fetch("/api/admin/upload", { method: "POST", body: form });
        const data = (await res.json()) as { url?: string; error?: string };
        if (!res.ok || !data.url) toast.error(data.error ?? `Could not upload ${file.name}.`);
        else setPhotos((old) => [...old, data.url!]);
      } finally {
        setUploading((n) => n - 1);
      }
    }
    if (fileRef.current) fileRef.current.value = "";
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await submitClaim({
        spentOn: v.spentOn,
        paymentMode: v.paymentMode,
        note: v.note,
        lines: lines.map((l) => ({ category: l.category, amount: Number(l.amount) || 0, description: l.description })),
        photos,
      });
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success("Sent for approval.");
      setV(blank);
      setLines([blankLine()]);
      setPhotos([]);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3 rounded-2xl border bg-card p-4 sm:p-5">
      <h2 className="font-heading font-semibold">Claim your expenses</h2>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
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
        <div className="space-y-1.5">
          <Label htmlFor="cl-mode">How you paid</Label>
          <select
            id="cl-mode"
            className={selectClass}
            value={v.paymentMode}
            onChange={(e) => setV((o) => ({ ...o, paymentMode: e.target.value }))}
          >
            {PAYMENT_MODES.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="cl-note">Where and why</Label>
        <Input
          id="cl-note"
          value={v.note}
          onChange={(e) => setV((o) => ({ ...o, note: e.target.value }))}
          placeholder="School visits in Uppal and Nagole"
          className="h-11"
          required
        />
      </div>

      <div className="space-y-2">
        <p className="text-sm font-medium">What you spent</p>
        {lines.map((l, i) => (
          <div key={i} className="grid grid-cols-[1fr_6.5rem_auto] items-center gap-2 rounded-xl border bg-muted/20 p-2 sm:grid-cols-[11rem_1fr_7rem_auto]">
            <select
              id={`cl-cat-${i}`}
              aria-label={`What expense ${i + 1} was for`}
              className={`${selectClass} col-span-3 sm:col-span-1`}
              value={l.category}
              onChange={(e) => setLine(i, { category: e.target.value as ClaimCategory })}
            >
              {CLAIM_CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
            <Input
              id={`cl-desc-${i}`}
              aria-label={`What exactly, expense ${i + 1}`}
              value={l.description}
              onChange={(e) => setLine(i, { description: e.target.value })}
              placeholder="Auto to Uppal and back"
              className="h-11"
            />
            <Input
              id={`cl-amount-${i}`}
              aria-label={`Amount in rupees, expense ${i + 1}`}
              inputMode="decimal"
              value={l.amount}
              onChange={(e) => setLine(i, { amount: e.target.value.replace(/[^\d.]/g, "") })}
              placeholder="Rs"
              className="h-11 text-right"
              required
            />
            <Button
              type="button"
              size="icon"
              variant="ghost"
              aria-label={`Remove expense ${i + 1}`}
              disabled={lines.length === 1}
              onClick={() => setLines((old) => old.filter((_, j) => j !== i))}
            >
              <Trash2 className="size-4" />
            </Button>
          </div>
        ))}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Button type="button" variant="outline" className="gap-2" onClick={() => setLines((old) => [...old, blankLine()])}>
            <Plus className="size-4" /> Add another expense
          </Button>
          <p className="font-heading text-lg font-bold tabular-nums">Total {formatINR(Math.round(total * 100))}</p>
        </div>
      </div>

      <div className="space-y-2">
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => {
            const files = Array.from(e.target.files ?? []);
            if (files.length) void upload(files);
          }}
        />
        {photos.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {photos.map((src, i) => (
              <div key={src} className="relative">
                {/* Unoptimized: the resizer fetches without the person's sign-in and staff photos refuse it */}
                <Image
                  src={src}
                  alt={`Bill ${i + 1}`}
                  width={56}
                  height={74}
                  unoptimized
                  className="h-[74px] w-14 rounded-md border object-cover"
                />
                <button
                  type="button"
                  aria-label={`Remove photo ${i + 1}`}
                  className="absolute -right-1.5 -top-1.5 flex size-6 items-center justify-center rounded-full border bg-background shadow"
                  onClick={() => setPhotos((old) => old.filter((p) => p !== src))}
                >
                  <X className="size-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            className="gap-2"
            disabled={uploading > 0 || photos.length >= 10}
            onClick={() => fileRef.current?.click()}
          >
            {uploading > 0 ? <Loader2 className="size-4 animate-spin" /> : <Camera className="size-4" />}
            {photos.length ? "Add more photos" : "Add photos of the bills"}
          </Button>
          <Button type="submit" className="ml-auto gap-2" disabled={busy || uploading > 0}>
            {busy ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
            Send for approval
          </Button>
        </div>
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
