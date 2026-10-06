"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2, Pencil } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { decideInvoice } from "@/lib/invoice-actions";

/**
 * Approve, send back, or send out.
 *
 * An executive raising a bill sees nothing here but Edit: approving is the
 * manager's call, and sending is refused until it has been approved.
 */
export function InvoiceDecisions({
  id,
  number,
  status,
  canApprove,
  canWrite,
}: {
  id: string;
  number: string;
  status: string;
  canApprove: boolean;
  canWrite: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);
  const [asking, setAsking] = React.useState(false);
  const [reason, setReason] = React.useState("");

  function run(decision: string, why?: string) {
    setBusy(true);
    void decideInvoice({ id, decision: decision as never, reason: why })
      .then((res) => {
        if (res.error) toast.error(res.error);
        else {
          toast.success(`${number} updated.`);
          setAsking(false);
          setReason("");
          router.refresh();
        }
      })
      .finally(() => setBusy(false));
  }

  if (asking) {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <Input
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="What needs fixing?"
          className="h-9 w-56"
          aria-label={`Reason for sending back ${number}`}
        />
        <Button variant="destructive" size="sm" disabled={busy} onClick={() => run("REJECTED", reason)}>
          {busy ? <Loader2 className="size-3.5 animate-spin" /> : "Send back"}
        </Button>
        <Button variant="ghost" size="sm" onClick={() => setAsking(false)}>
          Cancel
        </Button>
      </div>
    );
  }

  return (
    <>
      {canWrite && ["DRAFT", "PENDING_APPROVAL"].includes(status) && (
        <Button variant="outline" className="gap-2" asChild>
          <Link href={`/erp/invoices/${id}/edit`}>
            <Pencil className="size-4" /> Edit
          </Link>
        </Button>
      )}
      {canApprove && ["PENDING_APPROVAL", "DRAFT"].includes(status) && (
        <>
          <Button disabled={busy} onClick={() => run("APPROVED")}>
            {busy ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
            Approve
          </Button>
          {status === "PENDING_APPROVAL" && (
            <Button variant="outline" onClick={() => setAsking(true)}>
              Send back
            </Button>
          )}
        </>
      )}
      {canWrite && status === "APPROVED" && (
        <Button disabled={busy} onClick={() => run("SENT")}>
          {busy ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
          Mark as sent
        </Button>
      )}
      {status === "DRAFT" && !canApprove && (
        <span className="rounded-md border px-3 py-1.5 text-sm text-muted-foreground">
          Sent back. Edit and save to send it to your manager again.
        </span>
      )}
      {status === "PENDING_APPROVAL" && !canApprove && (
        <span className="rounded-md border border-saffron/40 bg-saffron/10 px-3 py-1.5 text-sm text-saffron-deep">
          Waiting for your manager to approve
        </span>
      )}
    </>
  );
}
