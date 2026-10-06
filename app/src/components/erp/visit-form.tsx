"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, Save } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { saveVisit } from "@/lib/crm-actions";

const selectClass =
  "flex h-12 w-full rounded-md border border-input bg-transparent px-3 text-base shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50";

/** A default follow-up date a week out, computed outside render. */
function aWeekFromToday(): string {
  return new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
}

const KINDS = [
  ["VISIT", "Visited the school"],
  ["CALL", "Phone call"],
  ["MEETING", "Meeting"],
  ["DEMO", "Demo or presentation"],
  ["SAMPLE_DROP", "Dropped samples"],
  ["FOLLOW_UP", "Follow up"],
  ["PAYMENT_CHASE", "Chased payment"],
  ["NOTE", "Just a note"],
] as const;

/**
 * Logged on a phone between schools, so the fields are large and there are
 * only seven of them. The next action is required, which is the owner's own
 * rule: nothing may sit in the system saying only "Called".
 */
export function VisitForm({
  organizations,
  defaultOrgId,
}: {
  organizations: { id: string; name: string }[];
  defaultOrgId?: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);
  const today = new Date().toISOString().slice(0, 10);
  const inAWeek = aWeekFromToday();

  const [v, setV] = React.useState({
    organizationId: defaultOrgId ?? organizations[0]?.id ?? "",
    visitedOn: today,
    kind: "VISIT",
    metWith: "",
    summary: "",
    outcome: "",
    nextAction: "",
    nextActionOn: inAWeek,
  });
  const set = (k: keyof typeof v, value: string) => setV((old) => ({ ...old, [k]: value }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await saveVisit({ ...v, kind: v.kind as never });
      if (res.error) toast.error(res.error);
      else {
        toast.success("Logged.");
        router.push(`/erp/organizations/${v.organizationId}`);
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="vi-org" className="text-base">
          Which school
        </Label>
        <select
          id="vi-org"
          className={selectClass}
          value={v.organizationId}
          onChange={(e) => set("organizationId", e.target.value)}
          required
        >
          {organizations.map((o) => (
            <option key={o.id} value={o.id}>
              {o.name}
            </option>
          ))}
        </select>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="vi-kind" className="text-base">
            What did you do
          </Label>
          <select
            id="vi-kind"
            className={selectClass}
            value={v.kind}
            onChange={(e) => set("kind", e.target.value)}
          >
            {KINDS.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="vi-date" className="text-base">
            When
          </Label>
          <Input
            id="vi-date"
            type="date"
            value={v.visitedOn}
            onChange={(e) => set("visitedOn", e.target.value)}
            className="h-12 text-base"
            required
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="vi-met" className="text-base">
          Who did you meet
        </Label>
        <Input
          id="vi-met"
          value={v.metWith}
          onChange={(e) => set("metWith", e.target.value)}
          className="h-12 text-base"
          placeholder="Principal, correspondent, head of department"
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="vi-summary" className="text-base">
          What happened
        </Label>
        <textarea
          id="vi-summary"
          value={v.summary}
          onChange={(e) => set("summary", e.target.value)}
          rows={3}
          className="w-full rounded-md border border-input bg-transparent p-3 text-base"
          required
        />
      </div>

      <div className="rounded-2xl border border-saffron/40 bg-saffron/5 p-4">
        <p className="mb-3 text-sm font-medium">
          What happens next? Both of these are required, so nothing is left sitting here saying
          only that you called.
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="vi-next" className="text-base">
              Next action
            </Label>
            <Input
              id="vi-next"
              value={v.nextAction}
              onChange={(e) => set("nextAction", e.target.value)}
              className="h-12 text-base"
              placeholder="Send the Grade 6 quotation"
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="vi-nexton" className="text-base">
              By when
            </Label>
            <Input
              id="vi-nexton"
              type="date"
              value={v.nextActionOn}
              onChange={(e) => set("nextActionOn", e.target.value)}
              className="h-12 text-base"
              required
            />
          </div>
        </div>
      </div>

      <Button type="submit" size="lg" disabled={busy || !v.organizationId} className="w-full gap-2 sm:w-auto">
        {busy ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
        Save it
      </Button>
    </form>
  );
}
