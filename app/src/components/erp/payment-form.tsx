"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, Save, Wallet } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { recordReceipt } from "@/lib/crm-actions";
import { formatINR } from "@/lib/money";
import { PAYMENT_MODES, type PaymentModeValue } from "@/lib/payment-modes";

const selectClass =
  "flex h-12 w-full rounded-md border border-input bg-transparent px-3 text-base shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50";

/** Today in India, computed outside render, whatever zone the device is in. */
function todayInIndia(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date());
}

export type PaymentOrg = { id: string; name: string; outstanding: number };

export type OpenInvoice = {
  id: string;
  organizationId: string;
  number: string;
  date: string;
  total: number;
  outstanding: number;
};

/**
 * Money in. Every school's open bills come down with the page and are
 * filtered here, so switching school does not wait on the server.
 */
export function PaymentForm({
  organizations,
  openInvoices,
  defaultOrgId,
}: {
  organizations: PaymentOrg[];
  openInvoices: OpenInvoice[];
  defaultOrgId?: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);
  const [v, setV] = React.useState(() => ({
    organizationId: organizations.some((o) => o.id === defaultOrgId) ? defaultOrgId! : "",
    receivedOn: todayInIndia(),
    amount: "",
    mode: "BANK_TRANSFER" as PaymentModeValue,
    reference: "",
    notes: "",
    invoiceIds: [] as string[],
  }));

  const org = organizations.find((o) => o.id === v.organizationId);
  const bills = openInvoices.filter((i) => i.organizationId === v.organizationId);
  const ticked = bills.filter((i) => v.invoiceIds.includes(i.id));
  const tickedOwed = ticked.reduce((s, i) => s + i.outstanding, 0);
  const amountPaise = Math.round((Number(v.amount) || 0) * 100);

  function pickOrg(id: string) {
    // Ticks belong to the old school's bills, so they go with it
    setV((old) => ({ ...old, organizationId: id, invoiceIds: [] }));
  }

  function toggle(id: string, on: boolean) {
    setV((old) => ({
      ...old,
      invoiceIds: on ? [...old.invoiceIds, id] : old.invoiceIds.filter((x) => x !== id),
    }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await recordReceipt({
        organizationId: v.organizationId,
        receivedOn: v.receivedOn,
        amount: Number(v.amount) || 0,
        mode: v.mode,
        reference: v.reference,
        notes: v.notes,
        invoiceIds: v.invoiceIds,
      });
      if (res.error) toast.error(res.error);
      else {
        toast.success(`Recorded as ${res.number}. Here is the receipt.`);
        // Straight to the receipt, so it can be printed or sent while the school is waiting
        router.push(res.id ? `/erp/payments/${res.id}` : `/erp/organizations/${v.organizationId}`);
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="pay-org" className="text-base">
          Which school paid
        </Label>
        <select
          id="pay-org"
          className={selectClass}
          value={v.organizationId}
          onChange={(e) => pickOrg(e.target.value)}
          required
        >
          <option value="">Pick the school</option>
          {organizations.map((o) => (
            <option key={o.id} value={o.id}>
              {o.name}
            </option>
          ))}
        </select>
        {org && (
          <p className="text-sm text-muted-foreground">
            {org.outstanding > 0
              ? `They owe ${formatINR(org.outstanding)} in all.`
              : "Nothing owing right now. A payment recorded now is held on their account."}
          </p>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="pay-amount" className="text-base">
            Amount in rupees
          </Label>
          <Input
            id="pay-amount"
            inputMode="decimal"
            value={v.amount}
            onChange={(e) => setV((old) => ({ ...old, amount: e.target.value.replace(/[^\d.]/g, "") }))}
            className="h-12 text-base"
            placeholder="25000"
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="pay-date" className="text-base">
            Received on
          </Label>
          <Input
            id="pay-date"
            type="date"
            value={v.receivedOn}
            onChange={(e) => setV((old) => ({ ...old, receivedOn: e.target.value }))}
            className="h-12 text-base"
            required
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="pay-mode" className="text-base">
            How they paid
          </Label>
          <select
            id="pay-mode"
            className={selectClass}
            value={v.mode}
            onChange={(e) => setV((old) => ({ ...old, mode: e.target.value as PaymentModeValue }))}
          >
            {PAYMENT_MODES.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="pay-ref" className="text-base">
            Reference
          </Label>
          <Input
            id="pay-ref"
            value={v.reference}
            onChange={(e) => setV((old) => ({ ...old, reference: e.target.value }))}
            className="h-12 text-base"
            placeholder="UTR or cheque number"
          />
        </div>
      </div>

      {org && (
        <section className="rounded-2xl border bg-card p-4">
          <h2 className="font-heading font-semibold">Which bills does it pay?</h2>
          <p className="mb-3 text-sm text-muted-foreground">
            Leave them all unticked and the payment settles the oldest bills first.
          </p>
          {bills.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No open bills for this school, so the whole amount is held on their account.
            </p>
          ) : (
            <ul className="space-y-2">
              {bills.map((b) => (
                <li key={b.id}>
                  <label className="flex cursor-pointer items-start gap-3 rounded-xl border p-3 hover:border-saffron">
                    <Checkbox
                      className="mt-1"
                      checked={v.invoiceIds.includes(b.id)}
                      onCheckedChange={(on) => toggle(b.id, on === true)}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block font-mono text-sm">{b.number}</span>
                      <span className="block text-xs text-muted-foreground">
                        {b.date} · bill {formatINR(b.total)}
                      </span>
                    </span>
                    <span className="text-right text-sm font-semibold">
                      {formatINR(b.outstanding)}
                      <span className="block text-xs font-normal text-muted-foreground">still due</span>
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          )}
          {ticked.length > 0 && amountPaise > tickedOwed && (
            <p className="mt-3 text-sm text-muted-foreground">
              That is {formatINR(amountPaise - tickedOwed)} more than the ticked bills. The rest is
              held on their account.
            </p>
          )}
        </section>
      )}

      <div className="space-y-1.5">
        <Label htmlFor="pay-notes" className="text-base">
          Notes
        </Label>
        <Textarea
          id="pay-notes"
          value={v.notes}
          onChange={(e) => setV((old) => ({ ...old, notes: e.target.value }))}
          rows={2}
          className="text-base"
          placeholder="Anything accounts should know"
        />
      </div>

      <Button
        type="submit"
        size="lg"
        disabled={busy || !v.organizationId}
        className="w-full gap-2 sm:w-auto"
      >
        {busy ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
        Record the payment
      </Button>
    </form>
  );
}

/**
 * Money in, straight from the bill: the amount starts at what is still due on
 * it, and the payment settles this bill before anything else. The page stays
 * put, so the balance on the bill updates in front of you.
 */
export function InvoicePayment({
  organizationId,
  invoiceId,
  due,
}: {
  organizationId: string;
  invoiceId: string;
  /** Paise still due on this bill. */
  due: number;
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const blank = () => ({
    receivedOn: todayInIndia(),
    amount: String(due / 100),
    mode: "BANK_TRANSFER" as PaymentModeValue,
    reference: "",
  });
  const [v, setV] = React.useState(blank);
  const amountPaise = Math.round((Number(v.amount) || 0) * 100);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await recordReceipt({
        organizationId,
        invoiceIds: [invoiceId],
        receivedOn: v.receivedOn,
        amount: Number(v.amount) || 0,
        mode: v.mode,
        reference: v.reference,
      });
      if (res.error) toast.error(res.error);
      else {
        toast.success(`Recorded as ${res.number}.`, {
          action: res.id ? { label: "Open the receipt", onClick: () => router.push(`/erp/payments/${res.id}`) } : undefined,
        });
        setOpen(false);
        router.refresh();
      }
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <Button
        className="gap-2"
        onClick={() => {
          setV(blank());
          setOpen(true);
        }}
      >
        <Wallet className="size-4" /> Record a payment
      </Button>
    );
  }

  return (
    <form onSubmit={submit} className="w-full space-y-3 rounded-2xl border bg-card p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-heading font-semibold">Record a payment against this bill</h2>
        <span className="text-sm text-muted-foreground">{formatINR(due)} still due</span>
      </div>
      <div className="grid gap-3 sm:grid-cols-4">
        <div className="space-y-1.5">
          <Label htmlFor="ip-amount">Amount in rupees</Label>
          <Input
            id="ip-amount"
            inputMode="decimal"
            value={v.amount}
            onChange={(e) => setV((old) => ({ ...old, amount: e.target.value.replace(/[^\d.]/g, "") }))}
            className="h-11"
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="ip-date">Received on</Label>
          <Input
            id="ip-date"
            type="date"
            value={v.receivedOn}
            onChange={(e) => setV((old) => ({ ...old, receivedOn: e.target.value }))}
            className="h-11"
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="ip-mode">How they paid</Label>
          <select
            id="ip-mode"
            className={`${selectClass} h-11 text-sm`}
            value={v.mode}
            onChange={(e) => setV((old) => ({ ...old, mode: e.target.value as PaymentModeValue }))}
          >
            {PAYMENT_MODES.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="ip-ref">Reference</Label>
          <Input
            id="ip-ref"
            value={v.reference}
            onChange={(e) => setV((old) => ({ ...old, reference: e.target.value }))}
            className="h-11"
            placeholder="UTR or cheque number"
          />
        </div>
      </div>
      <p className="text-sm text-muted-foreground">
        {amountPaise > due
          ? `That is ${formatINR(amountPaise - due)} more than this bill. The rest is held on their account.`
          : amountPaise > 0 && amountPaise < due
            ? `A part payment: ${formatINR(due - amountPaise)} will still be due on this bill.`
            : "This settles the bill in full."}
      </p>
      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={busy} className="gap-2">
          {busy ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />} Save the payment
        </Button>
        <Button type="button" variant="ghost" disabled={busy} onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
