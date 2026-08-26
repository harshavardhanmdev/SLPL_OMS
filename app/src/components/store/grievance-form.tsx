"use client";

import * as React from "react";
import Link from "next/link";
import { CheckCircle2, Copy, Loader2, Send } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { fileGrievance } from "@/lib/grievance-actions";
import { GRIEVANCE_CATEGORIES, isPaymentCategory } from "@/lib/grievance-constants";

const selectClass =
  "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50";

export function GrievanceForm({
  defaultOrder = "",
  defaultCategory = "",
  signedIn = false,
  knownName = "",
  knownEmail = "",
}: {
  defaultOrder?: string;
  defaultCategory?: string;
  signedIn?: boolean;
  knownName?: string;
  knownEmail?: string;
}) {
  const [busy, setBusy] = React.useState(false);
  const [done, setDone] = React.useState<{ ticketNumber: string; trackUrl: string } | null>(null);
  const [v, setV] = React.useState({
    category: defaultCategory,
    subject: "",
    description: "",
    contactName: knownName,
    contactEmail: knownEmail,
    contactPhone: "",
    orderRef: defaultOrder,
    paymentRef: "",
    amountClaimed: "",
    website: "",
  });

  function set(key: keyof typeof v, value: string) {
    setV((old) => ({ ...old, [key]: value }));
  }

  const isPayment = isPaymentCategory(v.category);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await fileGrievance(v);
      if (res.error) toast.error(res.error);
      else if (res.ticketNumber && res.trackUrl) {
        setDone({ ticketNumber: res.ticketNumber, trackUrl: res.trackUrl });
      }
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <div className="rounded-2xl border-2 border-green-600/30 bg-green-600/10 p-6">
        <div className="flex items-start gap-3">
          <CheckCircle2 className="size-8 shrink-0 text-green-700 dark:text-green-400" />
          <div className="min-w-0">
            <p className="font-heading text-lg font-semibold">Complaint registered</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Your ticket number is below. We have emailed it to {v.contactEmail} along with a link to
              track progress. We will acknowledge within 48 hours.
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <code className="rounded-lg border bg-background px-3 py-1.5 font-mono text-sm font-semibold">
                {done.ticketNumber}
              </code>
              <Button
                size="sm"
                variant="outline"
                className="gap-1.5"
                onClick={() => {
                  void navigator.clipboard.writeText(done.ticketNumber).then(
                    () => toast.success("Ticket number copied"),
                    () => toast.error("Could not copy"),
                  );
                }}
              >
                <Copy className="size-3.5" /> Copy
              </Button>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button size="sm" asChild>
                <Link href={done.trackUrl}>Track this complaint</Link>
              </Button>
              {signedIn && (
                <Button size="sm" variant="outline" asChild>
                  <Link href="/account/grievances">All my complaints</Link>
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-4 rounded-2xl border bg-card p-6">
      <div className="space-y-1.5">
        <Label htmlFor="category">What went wrong? *</Label>
        <select
          id="category"
          required
          value={v.category}
          onChange={(e) => set("category", e.target.value)}
          className={selectClass}
        >
          <option value="">Choose the closest match</option>
          {GRIEVANCE_CATEGORIES.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="subject">Subject *</Label>
        <Input
          id="subject"
          required
          maxLength={140}
          value={v.subject}
          onChange={(e) => set("subject", e.target.value)}
          placeholder="One line summary"
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="description">What happened? *</Label>
        <textarea
          id="description"
          required
          rows={5}
          maxLength={4000}
          value={v.description}
          onChange={(e) => set("description", e.target.value)}
          placeholder="Dates, amounts and anything you have already tried. The more detail, the faster we can fix it."
          className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="contactName">Your name *</Label>
          <Input
            id="contactName"
            required
            value={v.contactName}
            onChange={(e) => set("contactName", e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="contactEmail">Email *</Label>
          <Input
            id="contactEmail"
            type="email"
            required
            value={v.contactEmail}
            onChange={(e) => set("contactEmail", e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="contactPhone">Phone</Label>
          <Input
            id="contactPhone"
            inputMode="numeric"
            maxLength={10}
            value={v.contactPhone}
            onChange={(e) => set("contactPhone", e.target.value.replace(/\D/g, ""))}
            placeholder="10-digit mobile"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="orderRef">Order number</Label>
          <Input
            id="orderRef"
            value={v.orderRef}
            onChange={(e) => set("orderRef", e.target.value)}
            placeholder="SLPL-..."
          />
        </div>
      </div>

      {isPayment && (
        <div className="grid gap-4 rounded-xl border border-saffron/50 bg-accent/40 p-4 sm:grid-cols-2">
          <p className="text-xs text-muted-foreground sm:col-span-2">
            Payment details help us trace the transaction with the bank and Razorpay much faster.
          </p>
          <div className="space-y-1.5">
            <Label htmlFor="paymentRef">Transaction or UPI reference</Label>
            <Input
              id="paymentRef"
              value={v.paymentRef}
              onChange={(e) => set("paymentRef", e.target.value)}
              placeholder="UTR, UPI ref or pay_..."
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="amountClaimed">Amount debited (₹)</Label>
            <Input
              id="amountClaimed"
              inputMode="decimal"
              value={v.amountClaimed}
              onChange={(e) => set("amountClaimed", e.target.value.replace(/[^0-9.]/g, ""))}
              placeholder="459"
            />
          </div>
        </div>
      )}

      {/* Honeypot: hidden from people, irresistible to bots */}
      <input
        type="text"
        name="website"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
        value={v.website}
        onChange={(e) => set("website", e.target.value)}
        className="hidden"
      />

      <Button type="submit" size="lg" className="w-full gap-2" disabled={busy}>
        {busy ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
        Submit complaint
      </Button>
      <p className="text-xs text-muted-foreground">
        We use these details only to investigate and respond to your complaint. See our{" "}
        <Link href="/policies/privacy" className="underline underline-offset-2">
          privacy policy
        </Link>
        .
      </p>
    </form>
  );
}
