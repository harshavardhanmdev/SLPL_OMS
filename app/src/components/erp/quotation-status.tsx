"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Loader2, Pencil } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { setQuotationStatus } from "@/lib/quotation-actions";

const NEXT: Record<string, { status: string; label: string }[]> = {
  DRAFT: [{ status: "SENT", label: "Mark as sent" }],
  SENT: [
    { status: "ACCEPTED", label: "School accepted" },
    { status: "REJECTED", label: "Not taken up" },
  ],
  ACCEPTED: [],
  REJECTED: [{ status: "SENT", label: "Reopen" }],
  EXPIRED: [{ status: "SENT", label: "Reopen" }],
};

export function QuotationStatusControls({
  id,
  number,
  status,
}: {
  id: string;
  number: string;
  status: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);
  const options = NEXT[status] ?? [];

  return (
    <>
      {status === "DRAFT" && (
        <Button variant="outline" className="gap-2" asChild>
          <Link href={`/erp/quotations/${id}/edit`}>
            <Pencil className="size-4" /> Edit
          </Link>
        </Button>
      )}
      {options.map((o) => (
        <Button
          key={o.status}
          variant={o.status === "ACCEPTED" ? "default" : "outline"}
          disabled={busy}
          onClick={() => {
            setBusy(true);
            void setQuotationStatus({ id, status: o.status as never })
              .then((res) => {
                if (res.error) toast.error(res.error);
                else {
                  toast.success(`${number} updated.`);
                  router.refresh();
                }
              })
              .finally(() => setBusy(false));
          }}
        >
          {busy ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
          {o.label}
        </Button>
      ))}
    </>
  );
}
