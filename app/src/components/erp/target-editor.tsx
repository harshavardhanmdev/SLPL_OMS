"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, Pencil, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { saveTarget } from "@/lib/crm-actions";

/**
 * Set or change one target in place. The three figures sit together because
 * the owner sets them together: money, visits and new schools.
 */
export function TargetEditor({
  scope,
  ownerId,
  period,
  periodStart,
  revenue,
  visits,
  organizations,
  label,
}: {
  scope: "COMPANY" | "PERSON";
  ownerId: string | null;
  period: "MONTH" | "YEAR";
  /** yyyy-mm-dd */
  periodStart: string;
  /** Paise. */
  revenue: number;
  visits: number;
  organizations: number;
  label: string;
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [v, setV] = React.useState({
    revenue: revenue ? String(revenue / 100) : "",
    visits: visits ? String(visits) : "",
    organizations: organizations ? String(organizations) : "",
  });

  if (!open) {
    return (
      <Button
        size="sm"
        variant="ghost"
        className="gap-1.5"
        onClick={() => setOpen(true)}
        aria-label={`Set the target for ${label}`}
      >
        <Pencil className="size-3.5" /> {revenue || visits || organizations ? "Change" : "Set"}
      </Button>
    );
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        setBusy(true);
        void saveTarget({
          scope,
          ownerId,
          period,
          periodStart,
          revenueTarget: Number(v.revenue) || 0,
          visitTarget: Number(v.visits) || 0,
          organizationTarget: Number(v.organizations) || 0,
        })
          .then((res) => {
            if (res.error) toast.error(res.error);
            else {
              toast.success(`Target set for ${label}.`);
              setOpen(false);
              router.refresh();
            }
          })
          .finally(() => setBusy(false));
      }}
      className="grid w-full gap-2 rounded-xl bg-muted/50 p-3 motion-safe:animate-in motion-safe:fade-in-0 sm:grid-cols-[1fr_7rem_7rem_auto]"
    >
      <label className="space-y-1 text-xs text-muted-foreground">
        Revenue, rupees
        <Input
          inputMode="decimal"
          value={v.revenue}
          onChange={(e) => setV((o) => ({ ...o, revenue: e.target.value.replace(/[^\d.]/g, "") }))}
          className="h-10 text-sm text-foreground"
          autoFocus
        />
      </label>
      <label className="space-y-1 text-xs text-muted-foreground">
        Visits
        <Input
          inputMode="numeric"
          value={v.visits}
          onChange={(e) => setV((o) => ({ ...o, visits: e.target.value.replace(/\D/g, "") }))}
          className="h-10 text-sm text-foreground"
        />
      </label>
      <label className="space-y-1 text-xs text-muted-foreground">
        New schools
        <Input
          inputMode="numeric"
          value={v.organizations}
          onChange={(e) => setV((o) => ({ ...o, organizations: e.target.value.replace(/\D/g, "") }))}
          className="h-10 text-sm text-foreground"
        />
      </label>
      <div className="flex items-end gap-1">
        <Button type="submit" disabled={busy} className="h-10 gap-1.5">
          {busy ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
          Save
        </Button>
        <Button type="button" variant="ghost" className="h-10" onClick={() => setOpen(false)} aria-label="Cancel">
          <X className="size-4" />
        </Button>
      </div>
    </form>
  );
}
