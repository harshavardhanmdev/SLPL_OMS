"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, MapPin, Send } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  recordDispatch,
  recordIssueForAll,
  updateSubscriberAddress,
} from "@/lib/subscription-dispatch";

type Result = { ok?: boolean; error?: string; sent?: number; already?: number };

function useAction() {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);

  async function run(fn: () => Promise<Result>, done: (r: Result) => string) {
    setBusy(true);
    try {
      const res = await fn();
      if (res.error) toast.error(res.error);
      else {
        toast.success(done(res));
        router.refresh();
      }
      return res;
    } finally {
      setBusy(false);
    }
  }

  return { busy, run };
}

/** The whole posting run: one issue, everyone who is owed it. */
export function PostingRun({ issue, due }: { issue: string; due: number }) {
  const [label, setLabel] = React.useState(issue);
  const { busy, run } = useAction();

  return (
    <div className="rounded-2xl border bg-card p-4">
      <h2 className="font-heading font-semibold">Record a posting run</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Marks one issue as posted for every active subscriber who is owed it. Anyone already
        recorded is skipped, so pressing it twice is safe.
      </p>
      <div className="mt-3 flex flex-wrap items-end gap-2">
        <div className="min-w-48 flex-1">
          <Label htmlFor="run-issue" className="mb-1.5 block text-xs">
            Issue
          </Label>
          <Input
            id="run-issue"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="October 2026"
          />
        </div>
        <Button
          className="gap-2"
          disabled={busy || due === 0}
          onClick={() =>
            void run(
              () => recordIssueForAll(label),
              (r) =>
                r.sent === 0
                  ? "Everyone had already been recorded for that issue."
                  : `${r.sent} subscriber${r.sent === 1 ? "" : "s"} recorded as posted.`,
            )
          }
        >
          {busy ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
          {due === 0 ? "Nobody is due" : `Record for ${due} due`}
        </Button>
      </div>
    </div>
  );
}

/** One subscriber, one issue, for the copy that goes out late or on its own. */
export function DispatchOne({ id, issue, code }: { id: string; issue: string; code: string }) {
  const [open, setOpen] = React.useState(false);
  const [label, setLabel] = React.useState(issue);
  const { busy, run } = useAction();

  if (!open) {
    return (
      <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setOpen(true)}>
        <Send className="size-3.5" /> Record a dispatch
      </Button>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Input
        value={label}
        onChange={(e) => setLabel(e.target.value)}
        className="h-9 w-40"
        aria-label={`Issue posted to ${code}`}
      />
      <Button
        size="sm"
        className="gap-1.5"
        disabled={busy}
        onClick={() =>
          void run(
            () => recordDispatch({ subscriptionId: id, issue: label }),
            () => `${label} recorded for ${code}.`,
          ).then((r) => {
            if (r.ok) setOpen(false);
          })
        }
      >
        {busy ? <Loader2 className="size-3.5 animate-spin" /> : <Check className="size-3.5" />}
        Posted
      </Button>
      <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
        Cancel
      </Button>
    </div>
  );
}

export type Address = {
  id: string;
  subscriberName: string;
  phone: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  state: string;
  pincode: string;
};

/** Acting on the "reply and we will update it" line in the welcome email. */
export function EditAddress({ address }: { address: Address }) {
  const [open, setOpen] = React.useState(false);
  const [v, setV] = React.useState(address);
  const { busy, run } = useAction();
  const set = (k: keyof Address, value: string) => setV((old) => ({ ...old, [k]: value }));

  if (!open) {
    return (
      <Button variant="ghost" size="sm" className="gap-1.5" onClick={() => setOpen(true)}>
        <MapPin className="size-3.5" /> Change the address
      </Button>
    );
  }

  return (
    <div className="mt-2 grid gap-2 rounded-xl border bg-muted/30 p-3 sm:grid-cols-2">
      {(
        [
          ["subscriberName", "Name"],
          ["phone", "Phone"],
          ["addressLine1", "Address"],
          ["addressLine2", "Address line 2"],
          ["city", "City"],
          ["state", "State"],
          ["pincode", "Pincode"],
        ] as const
      ).map(([key, label]) => (
        <div key={key}>
          <Label htmlFor={`${address.id}-${key}`} className="mb-1 block text-xs">
            {label}
          </Label>
          <Input
            id={`${address.id}-${key}`}
            value={v[key]}
            onChange={(e) => set(key, e.target.value)}
            className="h-9"
          />
        </div>
      ))}
      <div className="flex items-end gap-2 sm:col-span-2">
        <Button
          size="sm"
          className="gap-1.5"
          disabled={busy}
          onClick={() =>
            void run(
              () => updateSubscriberAddress(v),
              () => "Address updated for the next issue.",
            ).then((r) => {
              if (r.ok) setOpen(false);
            })
          }
        >
          {busy ? <Loader2 className="size-3.5 animate-spin" /> : <Check className="size-3.5" />}
          Save
        </Button>
        <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
