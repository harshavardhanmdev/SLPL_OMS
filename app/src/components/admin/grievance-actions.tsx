"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { BadgeCheck, CheckCheck, Loader2, MessageSquarePlus, Search, TriangleAlert, XCircle } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  grievanceAcknowledge,
  grievanceAddNote,
  grievanceAwaitCustomer,
  grievanceClose,
  grievanceEscalate,
  grievanceResolve,
  grievanceStartWork,
} from "@/lib/grievance-admin-actions";

type Result = { ok?: boolean; error?: string };

/** Dialog for the actions that need the admin to type something first. */
function NoteDialog({
  trigger,
  title,
  description,
  label,
  placeholder,
  confirmLabel,
  busy,
  onConfirm,
}: {
  trigger: React.ReactNode;
  title: string;
  description: string;
  label: string;
  placeholder: string;
  confirmLabel: string;
  busy: boolean;
  onConfirm: (note: string) => Promise<boolean>;
}) {
  const [open, setOpen] = React.useState(false);
  const [note, setNote] = React.useState("");

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <div className="space-y-1.5">
          <Label htmlFor="note">{label}</Label>
          <textarea
            id="note"
            rows={5}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={placeholder}
            className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
          />
        </div>
        <DialogFooter>
          <Button
            disabled={busy || note.trim().length < 3}
            onClick={async () => {
              if (await onConfirm(note)) {
                setOpen(false);
                setNote("");
              }
            }}
          >
            {busy ? <Loader2 className="size-4 animate-spin" /> : null}
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function GrievanceActions({
  ticketNumber,
  status,
  compact = false,
}: {
  ticketNumber: string;
  status: string;
  /** Row mode on the board: only the stage-advancing buttons. */
  compact?: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = React.useState<string | null>(null);

  async function run(name: string, fn: () => Promise<Result>): Promise<boolean> {
    setBusy(name);
    try {
      const res = await fn();
      if (res.error) {
        toast.error(res.error);
        return false;
      }
      toast.success("Done");
      router.refresh();
      return true;
    } finally {
      setBusy(null);
    }
  }

  const btn = (
    name: string,
    label: string,
    icon: React.ReactNode,
    fn: () => Promise<Result>,
    variant: "default" | "outline" = "default",
  ) => (
    <Button
      key={name}
      variant={variant}
      size="sm"
      className="gap-1.5"
      disabled={busy !== null}
      onClick={() => void run(name, fn)}
    >
      {busy === name ? <Loader2 className="size-4 animate-spin" /> : icon}
      {label}
    </Button>
  );

  const isOpen = !["RESOLVED", "CLOSED"].includes(status);

  return (
    <div className="flex flex-wrap gap-2">
      {status === "OPEN" &&
        btn("ack", "Acknowledge", <BadgeCheck className="size-4" />, () => grievanceAcknowledge(ticketNumber))}

      {["OPEN", "ACKNOWLEDGED", "AWAITING_CUSTOMER"].includes(status) &&
        btn(
          "work",
          "Start investigating",
          <Search className="size-4" />,
          () => grievanceStartWork(ticketNumber),
          status === "OPEN" ? "outline" : "default",
        )}

      {isOpen && (
        <NoteDialog
          busy={busy === "await"}
          trigger={
            <Button variant="outline" size="sm" className="gap-1.5" disabled={busy !== null}>
              <MessageSquarePlus className="size-4" /> Ask the customer
            </Button>
          }
          title={`Ask for more information on ${ticketNumber}`}
          description="This is emailed to the customer and shown on their complaint page."
          label="What do you need from them?"
          placeholder="Please share the UTR number from your bank statement so we can trace the payment."
          confirmLabel="Send and mark awaiting"
          onConfirm={(note) => run("await", () => grievanceAwaitCustomer(ticketNumber, note))}
        />
      )}

      {isOpen && (
        <NoteDialog
          busy={busy === "resolve"}
          trigger={
            <Button size="sm" className="gap-1.5" disabled={busy !== null}>
              <CheckCheck className="size-4" /> Resolve
            </Button>
          }
          title={`Resolve ${ticketNumber}`}
          description="The customer is emailed this outcome and it is recorded as the resolution."
          label="What was the outcome?"
          placeholder="We traced the payment with the bank. The amount of Rs. 459 was reversed on 27 August and should reflect in your account within 3 working days."
          confirmLabel="Resolve and email"
          onConfirm={(note) => run("resolve", () => grievanceResolve(ticketNumber, note))}
        />
      )}

      {!compact && isOpen && status !== "ESCALATED" && (
        <NoteDialog
          busy={busy === "escalate"}
          trigger={
            <Button variant="outline" size="sm" className="gap-1.5" disabled={busy !== null}>
              <TriangleAlert className="size-4" /> Escalate
            </Button>
          }
          title={`Escalate ${ticketNumber}`}
          description="Flags the complaint internally and tells the customer it is being escalated."
          label="Why is this being escalated?"
          placeholder="Bank has not traced the transaction in 7 days, raising with Razorpay support."
          confirmLabel="Escalate"
          onConfirm={(note) => run("escalate", () => grievanceEscalate(ticketNumber, note))}
        />
      )}

      {!compact && (
        <NoteDialog
          busy={busy === "note"}
          trigger={
            <Button variant="outline" size="sm" className="gap-1.5" disabled={busy !== null}>
              <MessageSquarePlus className="size-4" /> Internal note
            </Button>
          }
          title={`Internal note on ${ticketNumber}`}
          description="Only visible in this panel. The customer never sees it and no email is sent."
          label="Note"
          placeholder="Called the customer, no answer. Trying again tomorrow."
          confirmLabel="Save note"
          onConfirm={(note) => run("note", () => grievanceAddNote(ticketNumber, note))}
        />
      )}

      {!compact &&
        status === "RESOLVED" &&
        btn("close", "Close", <XCircle className="size-4" />, () => grievanceClose(ticketNumber), "outline")}
    </div>
  );
}
