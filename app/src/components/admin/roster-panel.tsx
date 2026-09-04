"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { importRoster, purgeRoster, type RosterImportResult } from "@/lib/kit-admin-actions";

/**
 * CSV import for the student roster. Children's data, so the panel says so and
 * offers the end-of-year purge next to it rather than burying it.
 */
export function RosterPanel({
  schoolId,
  schoolName,
  classes,
}: {
  schoolId: string;
  schoolName: string;
  classes: { classLabel: string; count: number }[];
}) {
  const router = useRouter();
  const [csv, setCsv] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [result, setResult] = React.useState<RosterImportResult | null>(null);
  const [purging, setPurging] = React.useState(false);
  const [confirmName, setConfirmName] = React.useState("");

  async function readFile(file: File) {
    setCsv(await file.text());
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setResult(null);
    try {
      const res = await importRoster(schoolId, csv);
      if (res.error) toast.error(res.error);
      else {
        setResult(res);
        toast.success(`${res.added ?? 0} added, ${res.updated ?? 0} updated.`);
        setCsv("");
        router.refresh();
      }
    } finally {
      setBusy(false);
    }
  }

  async function purge() {
    setBusy(true);
    try {
      const res = await purgeRoster(schoolId, confirmName);
      if (res.error) toast.error(res.error);
      else {
        toast.success(`Roster purged: ${res.id}`);
        setPurging(false);
        setConfirmName("");
        router.refresh();
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      {classes.length > 0 && (
        <ul className="flex flex-wrap gap-2">
          {classes.map((c) => (
            <li key={c.classLabel} className="rounded-full border px-3 py-1 text-sm">
              {c.classLabel} <span className="text-muted-foreground">{c.count}</span>
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={submit} className="space-y-3">
        <div>
          <Label htmlFor="roster-file">CSV file</Label>
          <Input
            id="roster-file"
            type="file"
            accept=".csv,text/csv"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void readFile(file);
            }}
          />
          <p className="mt-1 text-xs text-muted-foreground">
            Columns: full name, class, section, roll number, guardian phone. A header row is
            ignored. Re-importing updates the matching students rather than duplicating them.
          </p>
        </div>

        <div>
          <Label htmlFor="roster-csv">Or paste the rows</Label>
          <textarea
            id="roster-csv"
            value={csv}
            onChange={(e) => setCsv(e.target.value)}
            rows={5}
            placeholder={"Aarav Sharma,Grade 3,A,12,9876543210\nDiya Reddy,Grade 3,A,13,"}
            className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 font-mono text-xs shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
          />
        </div>

        <Button type="submit" disabled={busy || csv.trim().length === 0} className="gap-2">
          {busy ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
          Import roster
        </Button>
      </form>

      {result && (
        <div className="rounded-xl border bg-secondary/50 p-4 text-sm dark:bg-card">
          <p className="font-medium">
            {result.added} added, {result.updated} updated
            {result.skipped && result.skipped.length > 0 ? `, ${result.skipped.length} skipped` : ""}
          </p>
          {result.skipped && result.skipped.length > 0 && (
            <ul className="mt-2 space-y-0.5 text-muted-foreground">
              {result.skipped.slice(0, 10).map((s) => (
                <li key={s.line}>
                  Line {s.line}: {s.reason}
                </li>
              ))}
              {result.skipped.length > 10 && <li>and {result.skipped.length - 10} more</li>}
            </ul>
          )}
        </div>
      )}

      <div className="rounded-xl border border-destructive/40 p-4">
        <p className="text-sm font-medium">End of year cleanup</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Student rosters are children&apos;s data. Hold them only while they are needed, and only
          with the school&apos;s consent. This removes every student who never bought a kit, and
          deactivates the rest so their receipts stay traceable.
        </p>
        {purging ? (
          <div className="mt-3 space-y-2">
            <Input
              value={confirmName}
              onChange={(e) => setConfirmName(e.target.value)}
              placeholder={`Type "${schoolName}" to confirm`}
            />
            <div className="flex gap-2">
              <Button
                variant="destructive"
                disabled={busy || confirmName !== schoolName}
                onClick={purge}
                className="gap-2"
              >
                {busy && <Loader2 className="size-4 animate-spin" />} Purge the roster
              </Button>
              <Button variant="ghost" onClick={() => setPurging(false)} disabled={busy}>
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <Button variant="outline" className="mt-3 gap-2" onClick={() => setPurging(true)}>
            <Trash2 className="size-4" /> Purge the roster
          </Button>
        )}
      </div>
    </div>
  );
}
