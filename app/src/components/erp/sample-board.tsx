"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, Loader2, PackageOpen, Plus, School, Undo2, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { SchoolPicker } from "@/components/erp/school-picker";
import { VoiceButton } from "@/components/erp/voice-button";
import { decideSamples, giveSamples, settleSamples, takeSamples } from "@/lib/sample-actions";
import { parseSamples, type SampleBook } from "@/lib/sample-parse";
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
 *
 * One box takes the lot, typed or spoken: "grade 5 all books, upsc 6 to 10,
 * 2 copies of genz". What it understood is listed before anything is saved,
 * to adjust or remove; each row becomes its own batch.
 */
export function SampleTaker({
  organizations,
  holders,
  books,
  meId,
  canAddSchool,
}: {
  organizations: Option[];
  /** Empty for anyone who can only record their own. */
  holders: Option[];
  books: SampleBook[];
  meId: string | null;
  canAddSchool: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [text, setText] = React.useState("");
  // Changes to what the box understood: a different quantity, or taken off
  // The quantity is kept as typed, so it can be cleared and retyped on a phone
  const [edits, setEdits] = React.useState<Record<string, { quantity?: string; removed?: boolean }>>({});
  // Phrases it could not place, kept as typed when asked
  const [typed, setTyped] = React.useState<string[]>([]);
  const [v, setV] = React.useState(() => ({
    issuedOn: todayIso(),
    holderId: meId ?? holders[0]?.id ?? "",
    organizationId: "",
    notes: "",
  }));
  const set = (k: keyof typeof v, value: string) => setV((old) => ({ ...old, [k]: value }));

  const parsed = React.useMemo(() => parseSamples(text, books), [text, books]);
  const picks = parsed.picks
    .filter((p) => !edits[p.key]?.removed)
    .map((p) => ({ ...p, typedQuantity: edits[p.key]?.quantity, quantity: Number(edits[p.key]?.quantity) || p.quantity }));
  const unknown = parsed.unknown.filter((u) => !typed.includes(u));
  const items = [
    ...picks.map((p) => ({ description: p.title, contents: p.contents, productId: p.productId, quantity: p.quantity })),
    ...typed.map((t) => ({ description: t, contents: null, productId: null, quantity: 1 })),
  ];

  function reset() {
    setText("");
    setEdits({});
    setTyped([]);
    setV((old) => ({ ...old, organizationId: "", notes: "" }));
  }

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
        if (items.length === 0) {
          toast.error("Say or type what you took first.");
          return;
        }
        setBusy(true);
        void takeSamples({
          items,
          issuedOn: v.issuedOn,
          holderId: v.holderId || null,
          organizationId: v.organizationId || null,
          notes: v.notes,
        })
          .then((res) => {
            if (res.error) toast.error(res.error);
            else {
              const what = res.count === 1 ? "1 item" : `${res.count} items`;
              toast.success(
                res.pending
                  ? `${what} recorded. They now wait for your manager to approve.`
                  : v.organizationId
                    ? `${what} recorded as given to the school.`
                    : `${what} recorded as in hand.`,
              );
              reset();
              setOpen(false);
              router.refresh();
            }
          })
          .finally(() => setBusy(false));
      }}
      className="space-y-3 rounded-2xl border bg-card p-4 motion-safe:animate-in motion-safe:fade-in-0 motion-safe:zoom-in-95 sm:p-5"
    >
      <h2 className="font-heading font-semibold">Samples taken</h2>
      <div className="space-y-1.5">
        <Label htmlFor="sa-what">What did you take?</Label>
        <div className="flex gap-2">
          <Textarea
            id="sa-what"
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              setEdits({});
            }}
            rows={2}
            placeholder="grade 5 all books, upsc 6 to 10, 2 copies of grade 3 english"
          />
          <VoiceButton
            label="Say what you took"
            onText={(said) => {
              setText((old) => (old.trim() ? `${old.trim()}, ${said}` : said));
              setEdits({});
            }}
          />
        </div>
        <p className="text-xs text-muted-foreground">
          A grade, a range of grades, a series or single titles, with how many if more than one. Separate them with
          commas.
        </p>
      </div>

      {(picks.length > 0 || typed.length > 0 || unknown.length > 0 || parsed.notes.length > 0) && (
        <div className="space-y-2 rounded-xl border bg-muted/30 p-3">
          {picks.length + typed.length > 0 && (
            <p className="text-xs font-semibold uppercase text-muted-foreground">
              {picks.length + typed.length} to record
            </p>
          )}
          <ul className="space-y-2">
            {picks.map((p) => (
              <li key={p.key} className="flex items-start justify-between gap-2 rounded-lg bg-card p-2">
                <div className="min-w-0">
                  <p className="text-sm font-medium">{p.title}</p>
                  {p.contents && <p className="text-xs text-muted-foreground">Includes {p.contents}</p>}
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <Input
                    aria-label={`How many of ${p.title}`}
                    inputMode="numeric"
                    value={p.typedQuantity ?? String(p.quantity)}
                    onChange={(e) => {
                      const typedNow = e.target.value.replace(/\D/g, "").slice(0, 4);
                      setEdits((old) => ({ ...old, [p.key]: { ...old[p.key], quantity: typedNow } }));
                    }}
                    className="h-9 w-14 text-center"
                  />
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    aria-label={`Leave out ${p.title}`}
                    onClick={() => setEdits((old) => ({ ...old, [p.key]: { ...old[p.key], removed: true } }))}
                  >
                    <X className="size-4" />
                  </Button>
                </div>
              </li>
            ))}
            {typed.map((t) => (
              <li key={t} className="flex items-center justify-between gap-2 rounded-lg bg-card p-2">
                <p className="text-sm font-medium">{t}</p>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  aria-label={`Leave out ${t}`}
                  onClick={() => setTyped((old) => old.filter((x) => x !== t))}
                >
                  <X className="size-4" />
                </Button>
              </li>
            ))}
          </ul>
          {unknown.map((u) => (
            <div key={u} className="flex flex-wrap items-center justify-between gap-2 text-sm text-saffron-deep">
              <span>Not sure what &ldquo;{u}&rdquo; is.</span>
              <Button type="button" size="sm" variant="outline" onClick={() => setTyped((old) => [...old, u])}>
                Record it as typed
              </Button>
            </div>
          ))}
          {parsed.notes.map((n) => (
            <p key={n} className="text-xs text-muted-foreground">
              {n}
            </p>
          ))}
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
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
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="sa-org">Already given to a school?</Label>
          <SchoolPicker
            id="sa-org"
            value={v.organizationId}
            onChange={(id) => set("organizationId", id)}
            organizations={organizations}
            noneLabel="No, still in hand"
            canAdd={canAddSchool}
          />
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
        <Button type="submit" disabled={busy || items.length === 0} className="gap-2">
          {busy ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
          {items.length > 1 ? `Record ${items.length} items` : "Record"}
        </Button>
        <Button
          type="button"
          variant="ghost"
          onClick={() => {
            reset();
            setOpen(false);
          }}
        >
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
  canAddSchool = false,
  approval = "APPROVED",
}: {
  id: string;
  status: string;
  quantity: number;
  organizations: Option[];
  canAddSchool?: boolean;
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
        <SchoolPicker
          id={`give-${id}`}
          value={give.organizationId}
          onChange={(organizationId) => setGive((g) => ({ ...g, organizationId }))}
          organizations={organizations}
          canAdd={canAddSchool}
        />
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
