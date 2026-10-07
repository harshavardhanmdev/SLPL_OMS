"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { FileSpreadsheet, Loader2, Upload } from "lucide-react";
import { readSheet } from "read-excel-file/browser";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { importOrganizations, type ImportResult, type ImportRow } from "@/lib/organization-actions";

const selectClass =
  "flex h-11 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50";

/** The headings a salesperson's sheet might use for each field, squashed to letters. */
const COLUMNS: Record<keyof ImportRow, { names: string[]; max: number }> = {
  name: {
    names: ["school", "schoolname", "name", "organisation", "organization", "organisationname", "organizationname", "institution", "institutionname", "college"],
    max: 120,
  },
  contactPerson: { names: ["contact", "contactperson", "contactname", "principal", "correspondent", "personname"], max: 80 },
  phone: {
    names: ["phone", "mobile", "phoneno", "phonenumber", "mobileno", "mobilenumber", "contactnumber", "contactno", "cell", "whatsapp"],
    max: 20,
  },
  email: { names: ["email", "emailid", "mail"], max: 120 },
  addressLine: { names: ["address", "area", "location", "street", "addressline"], max: 200 },
  city: { names: ["city", "town", "district"], max: 60 },
  state: { names: ["state"], max: 60 },
  pincode: { names: ["pincode", "pin", "pincodeno", "zip", "postalcode"], max: 10 },
  gstin: { names: ["gstin", "gst", "gstno", "gstnumber"], max: 20 },
};

const squash = (s: unknown) => String(s ?? "").toLowerCase().replace(/[^a-z]/g, "");

/** Rows of a CSV file, quotes and all. */
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (c === '"') quoted = false;
      else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") {
      row.push(cell);
      cell = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else cell += c;
  }
  if (cell || row.length) rows.push([...row, cell]);
  return rows;
}

/** The sheet's schools, from the first row that names a school column. */
function toRows(sheet: unknown[][]): ImportRow[] | string {
  const start = sheet.findIndex((r) => r.some((c) => COLUMNS.name.names.includes(squash(c))));
  if (start < 0) return "No column called School or Name was found. Put the headings in the first row.";
  const heads = sheet[start].map(squash);
  const at = Object.fromEntries(
    (Object.keys(COLUMNS) as (keyof ImportRow)[]).map((k) => [k, heads.findIndex((h) => COLUMNS[k].names.includes(h))]),
  ) as Record<keyof ImportRow, number>;
  return sheet
    .slice(start + 1)
    .map((r) => {
      const row = {} as ImportRow;
      for (const k of Object.keys(COLUMNS) as (keyof ImportRow)[]) {
        const v = at[k] >= 0 ? String(r[at[k]] ?? "").trim().slice(0, COLUMNS[k].max) : "";
        if (v) row[k] = v;
      }
      return row;
    })
    .filter((r) => r.name);
}

/**
 * A salesperson's list of schools, from Excel or CSV, read in the browser and
 * checked before anything is saved. New schools come in as leads.
 */
export function OrganizationImport({ people, canPickOwner }: { people: { id: string; name: string }[]; canPickOwner: boolean }) {
  const router = useRouter();
  const fileRef = React.useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = React.useState("");
  const [rows, setRows] = React.useState<ImportRow[]>([]);
  const [ownerId, setOwnerId] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [result, setResult] = React.useState<ImportResult | null>(null);

  async function read(file: File) {
    setResult(null);
    setRows([]);
    setFileName(file.name);
    try {
      const sheet = /\.csv$/i.test(file.name) ? parseCsv(await file.text()) : ((await readSheet(file)) as unknown[][]);
      const parsed = toRows(sheet);
      if (typeof parsed === "string") toast.error(parsed);
      else if (parsed.length === 0) toast.error("No schools found under the headings.");
      else setRows(parsed);
    } catch {
      toast.error("Could not read that file. Save it as .xlsx or .csv and try again.");
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function run() {
    setBusy(true);
    try {
      const res = await importOrganizations({ rows, ownerId: ownerId || null });
      if (res.error) {
        toast.error(res.error);
        return;
      }
      setResult(res);
      setRows([]);
      toast.success(`${res.created} ${res.created === 1 ? "school" : "schools"} added.`);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      <section className="space-y-3 rounded-2xl border bg-card p-4 sm:p-5">
        <p className="text-sm text-muted-foreground">
          One school per row, with headings in the first row. <b>School</b> (or Name) is needed; Contact person, Phone,
          Email, Address, City, State, Pincode and GSTIN are used when they are there.
        </p>
        <input
          ref={fileRef}
          type="file"
          accept=".xlsx,.csv"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void read(f);
          }}
        />
        <Button type="button" variant="outline" className="gap-2" onClick={() => fileRef.current?.click()}>
          <FileSpreadsheet className="size-4" /> Choose the Excel or CSV file
        </Button>
        {fileName && <p className="text-xs text-muted-foreground">{fileName}</p>}
      </section>

      {rows.length > 0 && (
        <section className="space-y-3 rounded-2xl border bg-card p-4 sm:p-5">
          <h2 className="font-heading font-semibold">
            {rows.length} {rows.length === 1 ? "school" : "schools"} in the sheet
          </h2>
          <ul className="divide-y rounded-xl border text-sm">
            {rows.slice(0, 8).map((r, i) => (
              <li key={i} className="flex flex-wrap justify-between gap-2 px-3 py-2">
                <span className="font-medium">{r.name}</span>
                <span className="text-muted-foreground">{[r.city, r.phone].filter(Boolean).join(" · ")}</span>
              </li>
            ))}
          </ul>
          {rows.length > 8 && <p className="text-xs text-muted-foreground">and {rows.length - 8} more</p>}
          {canPickOwner && (
            <div className="space-y-1.5">
              <Label htmlFor="im-owner">Looked after by</Label>
              <select id="im-owner" className={selectClass} value={ownerId} onChange={(e) => setOwnerId(e.target.value)}>
                <option value="">Nobody yet</option>
                {people.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
          )}
          <p className="text-xs text-muted-foreground">
            They come in as leads, not active yet. A school already on record, with the same name in the same city, is
            skipped. Each school turns active when its first quotation or invoice is raised.
          </p>
          <Button className="gap-2" disabled={busy} onClick={() => void run()}>
            {busy ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
            Import {rows.length} {rows.length === 1 ? "school" : "schools"}
          </Button>
        </section>
      )}

      {result && (
        <section className="space-y-2 rounded-2xl border bg-card p-4 sm:p-5">
          <h2 className="font-heading font-semibold">
            {result.created} added{result.skipped?.length ? `, ${result.skipped.length} skipped` : ""}
          </h2>
          {!!result.skipped?.length && (
            <ul className="divide-y rounded-xl border text-sm">
              {result.skipped.map((s, i) => (
                <li key={i} className="flex flex-wrap justify-between gap-2 px-3 py-2">
                  <span>{s.name}</span>
                  <span className="text-muted-foreground">{s.reason}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}
