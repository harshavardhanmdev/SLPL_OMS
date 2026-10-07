"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Loader2, Pencil, ReceiptText, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { decideQuotation, deleteQuotation } from "@/lib/quotation-actions";

type Decision = "APPROVED" | "REJECTED_BACK" | "SENT" | "ACCEPTED" | "REJECTED" | "EXPIRED";

/**
 * Approve or send back, then send out, then record what the school decided.
 * An executive sees Edit and a waiting note until the manager has approved.
 */
export function QuotationStatusControls({
  id,
  number,
  status,
  canApprove,
  canWrite,
  canInvoice,
  canDelete = false,
}: {
  id: string;
  number: string;
  status: string;
  canApprove: boolean;
  canWrite: boolean;
  canInvoice: boolean;
  /** Owners. A quotation already billed is refused by the action, with the reason. */
  canDelete?: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);
  const [asking, setAsking] = React.useState(false);
  const [reason, setReason] = React.useState("");

  function run(decision: Decision, why?: string) {
    setBusy(true);
    void decideQuotation({ id, decision, reason: why })
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
        <Button variant="destructive" size="sm" disabled={busy} onClick={() => run("REJECTED_BACK", reason)}>
          {busy ? <Loader2 className="size-3.5 animate-spin" /> : "Send back"}
        </Button>
        <Button variant="ghost" size="sm" onClick={() => setAsking(false)}>
          Cancel
        </Button>
      </div>
    );
  }

  const spinner = busy ? <Loader2 className="mr-2 size-4 animate-spin" /> : null;

  function remove() {
    if (!window.confirm(`Delete ${number}? This cannot be undone. Use it only for a quotation raised by mistake.`)) return;
    setBusy(true);
    void deleteQuotation({ id })
      .then((res) => {
        if (res.error) toast.error(res.error);
        else {
          toast.success(`${number} deleted.`);
          router.push("/erp/quotations");
        }
      })
      .finally(() => setBusy(false));
  }

  return (
    <>
      {canDelete && (
        <Button variant="ghost" className="gap-2 text-destructive" disabled={busy} onClick={remove}>
          <Trash2 className="size-4" /> Delete
        </Button>
      )}
      {canWrite && ["DRAFT", "PENDING_APPROVAL", "APPROVED"].includes(status) && (
        <Button variant="outline" className="gap-2" asChild>
          <Link href={`/erp/quotations/${id}/edit`}>
            <Pencil className="size-4" /> Edit
          </Link>
        </Button>
      )}
      {canApprove && ["DRAFT", "PENDING_APPROVAL"].includes(status) && (
        <Button disabled={busy} onClick={() => run("APPROVED")}>
          {spinner}
          Approve
        </Button>
      )}
      {canApprove && status === "PENDING_APPROVAL" && (
        <Button variant="outline" onClick={() => setAsking(true)}>
          Send back
        </Button>
      )}
      {!canApprove && status === "PENDING_APPROVAL" && (
        <span className="rounded-md border border-saffron/40 bg-saffron/10 px-3 py-1.5 text-sm text-saffron-deep">
          Waiting for your manager to approve
        </span>
      )}
      {!canApprove && status === "DRAFT" && (
        <span className="rounded-md border px-3 py-1.5 text-sm text-muted-foreground">
          Sent back. Edit and save to send it to your manager again.
        </span>
      )}
      {canWrite && status === "APPROVED" && (
        <Button disabled={busy} onClick={() => run("SENT")}>
          {spinner}
          Mark as sent
        </Button>
      )}
      {canWrite && status === "SENT" && (
        <>
          <Button disabled={busy} onClick={() => run("ACCEPTED")}>
            {spinner}
            School accepted
          </Button>
          <Button variant="outline" disabled={busy} onClick={() => run("REJECTED")}>
            Not taken up
          </Button>
        </>
      )}
      {canWrite && ["REJECTED", "EXPIRED"].includes(status) && (
        <Button variant="outline" disabled={busy} onClick={() => run("SENT")}>
          Reopen
        </Button>
      )}
      {canInvoice && status === "ACCEPTED" && (
        <Button className="gap-2" asChild>
          <Link href={`/erp/invoices/new?quotation=${id}`}>
            <ReceiptText className="size-4" /> Raise the invoice
          </Link>
        </Button>
      )}
    </>
  );
}
