"use client";

import * as React from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Loader2, Save } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { UploadButton } from "@/components/admin/upload-button";
import { saveCompanyProfile, type CompanyInput } from "@/lib/company-actions";

const FIELDS: { key: keyof CompanyInput; label: string; hint?: string }[] = [
  { key: "company_tagline", label: "Tagline", hint: "Printed under the company name" },
  { key: "company_address", label: "Registered address" },
  { key: "contact_phone", label: "Mobile" },
  { key: "company_alt_phone", label: "Second mobile" },
  { key: "contact_email", label: "Email" },
  { key: "company_gstin", label: "GSTIN" },
  { key: "company_pan", label: "PAN" },
  { key: "company_cin", label: "CIN" },
  { key: "bank_name", label: "Bank account name" },
  { key: "bank_account_no", label: "Account number" },
  { key: "bank_ifsc", label: "IFSC" },
  { key: "bank_branch", label: "Bank and branch" },
  { key: "upi_id", label: "UPI ID", hint: "Becomes the payment QR on every bill" },
];

export function CompanyForm({ initial }: { initial: CompanyInput }) {
  const router = useRouter();
  const [v, setV] = React.useState<CompanyInput>(initial);
  const [busy, setBusy] = React.useState(false);

  const set = (k: keyof CompanyInput, value: string) => setV((old) => ({ ...old, [k]: value }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await saveCompanyProfile(v);
      if (res.error) toast.error(res.error);
      else {
        toast.success("Saved. Every document picks this up immediately.");
        router.refresh();
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      <section className="rounded-2xl border bg-card p-4 sm:p-5">
        <h2 className="mb-3 font-heading font-semibold">What prints on every document</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {FIELDS.map((f) => (
            <div key={f.key} className="space-y-1.5">
              <Label htmlFor={`co-${f.key}`}>{f.label}</Label>
              <Input
                id={`co-${f.key}`}
                value={v[f.key]}
                onChange={(e) => set(f.key, e.target.value)}
                className="h-11"
              />
              {f.hint && <p className="text-xs text-muted-foreground">{f.hint}</p>}
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border bg-card p-4 sm:p-5">
        <h2 className="mb-1 font-heading font-semibold">Authorised signature</h2>
        <p className="mb-3 text-sm text-muted-foreground">
          Upload a scan on a white background. It is stored where only an admin can fetch it and
          embedded into each document as it prints, never linked, so it does not sit on a public
          URL for anyone to lift.
        </p>
        <div className="flex flex-wrap items-center gap-4">
          <UploadButton
            kind="receipt"
            label={v.signature_image ? "Replace signature" : "Upload signature"}
            onUploaded={(url) => set("signature_image", url)}
          />
          {v.signature_image && (
            <>
              <Image
                src={v.signature_image}
                alt="Authorised signature"
                width={180}
                height={70}
                className="h-16 w-auto rounded border bg-white object-contain p-1"
                unoptimized
              />
              <Button type="button" variant="ghost" size="sm" onClick={() => set("signature_image", "")}>
                Remove
              </Button>
            </>
          )}
        </div>
      </section>

      <Button type="submit" size="lg" disabled={busy} className="gap-2">
        {busy ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
        Save the profile
      </Button>
    </form>
  );
}
