"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, MessageSquarePlus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { addRemark, deleteRemark } from "@/lib/organization-actions";

export type Remark = { id: string; text: string; by: string; at: string; canDelete: boolean };

/** Remarks on one school, newest first, with a box to add one. */
export function SchoolRemarks({
  organizationId,
  remarks,
  canAdd,
}: {
  organizationId: string;
  remarks: Remark[];
  canAdd: boolean;
}) {
  const router = useRouter();
  const [text, setText] = React.useState("");
  // Which button is working: "add", or the id of a remark being removed
  const [busy, setBusy] = React.useState<string | null>(null);
  // Shown straight from the save, so nobody waits on the page refreshing
  const [added, setAdded] = React.useState<Remark[]>([]);
  const [removed, setRemoved] = React.useState<string[]>([]);
  const shown = [...added.filter((a) => !remarks.some((r) => r.id === a.id)), ...remarks].filter(
    (r) => !removed.includes(r.id),
  );

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setBusy("add");
    try {
      const res = await addRemark({ organizationId, text });
      if (res.error || !res.remark) toast.error(res.error ?? "Could not save the remark.");
      else {
        const remark = res.remark;
        setAdded((old) => [remark, ...old]);
        setText("");
        router.refresh();
      }
    } finally {
      setBusy(null);
    }
  }

  async function remove(id: string) {
    if (!window.confirm("Remove this remark?")) return;
    setBusy(id);
    try {
      const res = await deleteRemark(id);
      if (res.error) toast.error(res.error);
      else {
        setRemoved((old) => [...old, id]);
        router.refresh();
      }
    } finally {
      setBusy(null);
    }
  }

  return (
    <div>
      {canAdd && (
        <form onSubmit={add} className="space-y-2 border-b p-4">
          <Textarea
            id="remark-text"
            aria-label="New remark"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Principal wants the UPSC samples before Diwali"
            rows={2}
          />
          <Button type="submit" size="sm" className="gap-1.5" disabled={busy !== null || text.trim().length < 2}>
            {busy === "add" ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <MessageSquarePlus className="size-3.5" />
            )}
            Add remark
          </Button>
        </form>
      )}
      {shown.length === 0 ? (
        <p className="p-6 text-center text-sm text-muted-foreground">No remarks yet.</p>
      ) : (
        <ul className="divide-y">
          {shown.map((r) => (
            <li key={r.id} className="flex items-start justify-between gap-3 p-4">
              <div className="min-w-0">
                <p className="whitespace-pre-line text-sm">{r.text}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {r.by} · {r.at}
                </p>
              </div>
              {r.canDelete && (
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  aria-label="Remove this remark"
                  disabled={busy !== null}
                  onClick={() => void remove(r.id)}
                >
                  {busy === r.id ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
