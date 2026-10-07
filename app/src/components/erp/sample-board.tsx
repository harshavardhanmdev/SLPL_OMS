"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, Loader2, PackageOpen, Plus, School, Undo2, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { decideSamples, giveSamples, settleSamples, takeSamples } from "@/lib/sample-actions";
import { todayLocalIso } from "@/lib/utils";

const selectClass =
  "flex h-11 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50";

type Option = { id: string; name: string };

/** Today on the phone's own clock, worked out outside render. */
function todayIso(): string {
  return todayLocalIso();
}

/**
 * Copies leaving the office. They go into someone's bag first; naming a school
 * here is only for the times they were handed straight over.
 */
export function SampleTaker({
  organizations,
  holders,
  titles,
  meId,
}: {
  organizations: Option[];
  /** Empty for anyone who can only record their own. */
  holders: Option[];
  titles: string[];
  meId: string | null;
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [v, setV] = React.useState(() => ({
    description: "",
    quantity: "1",
    issuedOn: todayIso(),
    holderId: meId ?? holders[0]?.id ?? "",
    organizationId: "",
    notes: "",
  }));
  const set = (k: keyof typeof v, value: string) => setV((old) => ({ ...old, [k]: value }));

  if (!open) {
    return (
      <Button size="lg" className="gap-2" onClick={() => setOpen(true)}>
        <Plus className="size-4" /> Take samples from the office
      </Button>
    );
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        setBusy(true);
        void takeSamples({
          description: v.description,
          quantity: Number(v.quantity) || 1,
          issuedOn: v.issuedOn,
          holderId: v.holderId || null,
          organizationId: v.organizationId || null,
          notes: v.notes,
        })
          .then((res) => {
            if (res.error) toast.error(res.error);
            else {
              toast.success(
                res.pending
                  ? "Recorded. It now waits for your manager to approve."
                  : v.organizationId
                    ? "Recorded as given to the school."
                    : "Recorded as in hand.",
              );
              setV((old) => ({ ...old, description: "", quantity: "1", organizationId: "", notes: "" }));
              setOpen(false);
              router.refresh();
            }
          })
          .finally(() => setBusy(false));
      }}
      className="space-y-3 rounded-2xl border bg-card p-4 motion-safe:animate-in motion-safe:fade-in-0 motion-safe:zoom-in-95 sm:p-5"
    >
      <h2 className="font-heading font-semibold">Samples taken</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="sa-desc">Which title</Label>
          <Input
            id="sa-desc"
            list="sa-titles"
            value={v.description}
            onChange={(e) => set("description", e.target.value)}
            className="h-11"
            placeholder="Start typing, or describe a set"
            required
          />
          <datalist id="sa-titles">
            {titles.map((t) => (
              <option key={t} value={t} />
            ))}
          </datalist>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="sa-qty">How many copies</Label>
          <Input
            id="sa-qty"
            inputMode="numeric"
            value={v.quantity}
            onChange={(e) => set("quantity", e.target.value.replace(/\D/g, ""))}
            className="h-11"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="sa-date">Taken on</Label>
          <Input
            id="sa-date"
            type="date"
            value={v.issuedOn}
            onChange={(e) => set("issuedOn", e.target.value)}
            className="h-11"
          />
        </div>
        {holders.length > 0 && (
          <div className="space-y-1.5">
            <Label htmlFor="sa-holder">Who has them</Label>
            <select
              id="sa-holder"
              className={selectClass}
              value={v.holderId}
              onChange={(e) => set("holderId", e.target.value)}
            >
              {holders.map((h) => (
                <option key={h.id} value={h.id}>
                  {h.name}
                </option>
              ))}
            </select>
          </div>
        )}
        <div className="space-y-1.5">
          <Label htmlFor="sa-org">Already given to a school?</Label>
          <select
            id="sa-org"
            className={selectClass}
            value={v.organizationId}
            onChange={(e) => set("organizationId", e.target.value)}
          >
            <option value="">No, still in hand</option>
            {organizations.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="sa-notes">Note</Label>
          <Input
            id="sa-notes"
            value={v.notes}
            onChange={(e) => set("notes", e.target.value)}
            className="h-11"
          />
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={busy} className="gap-2">
          {busy ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
          Record
        </Button>
        <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

/**
 * What can happen to one batch from here. Copies in hand can go to a school,
 * back to the office or be written off; copies at a school can become an
 * order, come back, or go back in the bag if they were recorded by mistake.
 */
export function SampleActions({
  id,
  status,
  quantity,
  organizations,
  approval = "APPROVED",
}: {
  id: string;
  status: string;
  quantity: number;
  organizations: Option[];
  /** Only an approved batch can go to a school. */
  approval?: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);
  const [giving, setGiving] = React.useState(false);
  const [give, setGive] = React.useState(() => ({
    organizationId: organizations[0]?.id ?? "",
    quantity: String(quantity),
    givenOn: todayIso(),
  }));

  function settle(next: "IN_HAND" | "RETURNED" | "CONVERTED" | "WRITTEN_OFF", done: string) {
    setBusy(true);
    void settleSamples({ id, status: next })
      .then((res) => {
        if (res.error) toast.error(res.error);
        else {
          toast.success(done);
          router.refresh();
        }
      })
      .finally(() => setBusy(false));
  }

  if (giving) {
    if (organizations.length === 0) {
      return (
        <p className="w-full rounded-xl bg-muted/60 p-3 text-sm">
          There are no schools on record yet.{" "}
          <Link href="/erp/organizations/new" className="font-medium underline">
            Add the school
          </Link>{" "}
          first, then come back to hand these over.
        </p>
      );
    }
    return (
      <form
        onSubmit={(e) => {
          e.preventDefault();
          setBusy(true);
          void giveSamples({
            id,
            organizationId: give.organizationId,
            quantity: Number(give.quantity) || 0,
            givenOn: give.givenOn,
          })
            .then((res) => {
              if (res.error) toast.error(res.error);
              else {
                toast.success("Handed over.");
                setGiving(false);
                router.refresh();
              }
            })
            .finally(() => setBusy(false));
        }}
        className="grid w-full gap-2 rounded-xl bg-muted/50 p-3 motion-safe:animate-in motion-safe:fade-in-0 sm:grid-cols-[1fr_6rem_9rem_auto]"
      >
        <select
          aria-label="School"
          className={selectClass}
          value={give.organizationId}
          onChange={(e) => setGive((g) => ({ ...g, organizationId: e.target.value }))}
        >
          {organizations.map((o) => (
            <option key={o.id} value={o.id}>
              {o.name}
            </option>
          ))}
        </select>
        <Input
          aria-label={`How many, up to ${quantity}`}
          inputMode="numeric"
          value={give.quantity}
          onChange={(e) => setGive((g) => ({ ...g, quantity: e.target.value.replace(/\D/g, "") }))}
          className="h-11"
        />
        <Input
          aria-label="Given on"
          type="date"
          value={give.givenOn}
          onChange={(e) => setGive((g) => ({ ...g, givenOn: e.target.value }))}
          className="h-11"
        />
        <div className="flex gap-1">
          <Button type="submit" disabled={busy} className="h-11 gap-1.5">
            {busy ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
            Give
          </Button>
          <Button
            type="button"
            variant="ghost"
            className="h-11"
            onClick={() => setGiving(false)}
            aria-label="Cancel"
          >
            <X className="size-4" />
          </Button>
        </div>
      </form>
    );
  }

  return (
    <div className="flex flex-wrap gap-1.5">
      {status === "IN_HAND" && (
        <>
          {approval === "APPROVED" && (
            <Button size="sm" className="gap-1.5" disabled={busy} onClick={() => setGiving(true)}>
              <School className="size-3.5" /> Give to a school
            </Button>
          )}
          <Button
            size="sm"
            variant="outline"
            disabled={busy}
            onClick={() => settle("RETURNED", "Back at the office.")}
          >
            Returned
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="text-muted-foreground"
            disabled={busy}
            onClick={() => settle("WRITTEN_OFF", "Written off.")}
          >
            Write off
          </Button>
        </>
      )}
      {status === "WITH_SCHOOL" && (
        <>
          <Button
            size="sm"
            className="gap-1.5"
            disabled={busy}
            onClick={() => settle("CONVERTED", "Marked as an order. Well done.")}
          >
            <Check className="size-3.5" /> Became an order
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={busy}
            onClick={() => settle("RETURNED", "Back at the office.")}
          >
            Returned
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="gap-1.5 text-muted-foreground"
            disabled={busy}
            onClick={() => settle("IN_HAND", "Back in hand.")}
          >
            <Undo2 className="size-3.5" /> Still with me
          </Button>
        </>
      )}
      {["RETURNED", "CONVERTED", "WRITTEN_OFF"].includes(status) && (
        <Button
          size="sm"
          variant="ghost"
          className="gap-1.5 text-muted-foreground"
          disabled={busy}
          onClick={() => settle("IN_HAND", "Back in hand.")}
        >
          <PackageOpen className="size-3.5" /> Undo, back in hand
        </Button>
      )}
    </div>
  );
}

/**
 * The manager's call on an executive's batch: approve it, or send it back with
 * a reason the executive will see on the row.
 */
export function SampleDecision({ id, title }: { id: string; title: string }) {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);
  const [asking, setAsking] = React.useState(false);
  const [reason, setReason] = React.useState("");

  function run(decision: "APPROVED" | "REJECTED", why?: string) {
    setBusy(true);
    void decideSamples({ id, decision, reason: why })
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
          placeholder="Why are these going back?"
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
