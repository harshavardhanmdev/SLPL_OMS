"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, Pencil, Plus, ShieldOff } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { revokeSessions, saveStaff } from "@/lib/staff-actions";

const selectClass =
  "flex h-11 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50";

const ROLES = [
  { value: "OWNER", label: "Owner, everything including staff" },
  { value: "MANAGER", label: "Manager, everything except staff" },
  { value: "ACCOUNTS", label: "Accounts, finance and orders" },
  { value: "SALES_MANAGER", label: "Sales manager, raises quotations" },
  { value: "SALES", label: "Sales executive, reads quotations and orders" },
  { value: "WAREHOUSE", label: "Warehouse, shipments and stock" },
  { value: "SUPPORT", label: "Support, grievances only" },
  { value: "CA_READONLY", label: "CA, reads finance and changes nothing" },
];

type Person = {
  id: string;
  email: string;
  name: string;
  role: string;
  phone: string | null;
  reportsToId: string | null;
  reportsToName: string | null;
  isActive: boolean;
  lastLoginAt: string | null;
  activeSessions: number;
};

type FormValue = {
  id?: string;
  email: string;
  name: string;
  role: string;
  phone: string;
  reportsToId: string;
  password: string;
  isActive: boolean;
};

const blank: FormValue = {
  email: "",
  name: "",
  role: "SALES",
  phone: "",
  reportsToId: "",
  password: "",
  isActive: true,
};

export function StaffManager({ people }: { people: Person[] }) {
  const router = useRouter();
  const [editing, setEditing] = React.useState<string | null>(people.length === 0 ? "new" : null);
  const [v, setV] = React.useState<FormValue>(blank);
  const [busy, setBusy] = React.useState(false);

  const set = <K extends keyof FormValue>(k: K, value: FormValue[K]) =>
    setV((old) => ({ ...old, [k]: value }));

  async function run(fn: () => Promise<{ ok?: boolean; error?: string }>, done: string) {
    setBusy(true);
    try {
      const res = await fn();
      if (res.error) {
        toast.error(res.error === "FORBIDDEN" ? "Only an owner can do that." : res.error);
      } else {
        toast.success(done);
        setV(blank);
        setEditing(null);
        router.refresh();
      }
    } finally {
      setBusy(false);
    }
  }

  function startEdit(p: Person) {
    setV({
      id: p.id,
      email: p.email,
      name: p.name,
      role: p.role,
      phone: p.phone ?? "",
      reportsToId: p.reportsToId ?? "",
      password: "",
      isActive: p.isActive,
    });
    setEditing(p.id);
  }

  const form = (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void run(
          () =>
            saveStaff({
              id: v.id,
              email: v.email,
              name: v.name,
              role: v.role,
              phone: v.phone,
              reportsToId: v.reportsToId || null,
              password: v.password,
              isActive: v.isActive,
            }),
          v.id ? "Saved." : "Account created.",
        );
      }}
      className="space-y-4 rounded-2xl border bg-card p-5"
    >
      <h2 className="font-heading font-semibold">{v.id ? `Edit ${v.name}` : "Add someone"}</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="st-name">Full name</Label>
          <Input
            id="st-name"
            value={v.name}
            onChange={(e) => set("name", e.target.value)}
            className="h-11"
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="st-email">Email they sign in with</Label>
          <Input
            id="st-email"
            type="email"
            value={v.email}
            onChange={(e) => set("email", e.target.value)}
            className="h-11"
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="st-phone">Phone</Label>
          <Input
            id="st-phone"
            value={v.phone}
            onChange={(e) => set("phone", e.target.value)}
            className="h-11"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="st-role">Role</Label>
          <select
            id="st-role"
            className={selectClass}
            value={v.role}
            onChange={(e) => set("role", e.target.value)}
          >
            {ROLES.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="st-reports">Reports to</Label>
          <select
            id="st-reports"
            className={selectClass}
            value={v.reportsToId}
            onChange={(e) => set("reportsToId", e.target.value)}
          >
            <option value="">Nobody</option>
            {people
              .filter((p) => p.id !== v.id)
              .map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.role.toLowerCase().replace("_", " ")})
                </option>
              ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="st-password">{v.id ? "New password, to change it" : "Password"}</Label>
          <Input
            id="st-password"
            type="password"
            value={v.password}
            onChange={(e) => set("password", e.target.value)}
            className="h-11"
            placeholder={v.id ? "Leave blank to keep it" : ""}
            required={!v.id}
          />
          <p className="text-xs text-muted-foreground">
            Changing it signs them out everywhere immediately.
          </p>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={busy} className="gap-2">
          {busy ? <Loader2 className="size-4 animate-spin" /> : null}
          {v.id ? "Save changes" : "Create the account"}
        </Button>
        <Button
          type="button"
          variant="ghost"
          onClick={() => {
            setEditing(null);
            setV(blank);
          }}
        >
          Cancel
        </Button>
      </div>
    </form>
  );

  return (
    <div className="space-y-5">
      <ul className="divide-y rounded-2xl border bg-card">
        {people.map((p) => (
          <li key={p.id} className="p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="flex flex-wrap items-center gap-2 font-medium">
                  {p.name}
                  <Badge variant="secondary">{p.role.toLowerCase().replace("_", " ")}</Badge>
                  {!p.isActive && <Badge variant="outline">inactive</Badge>}
                  {p.activeSessions > 0 && (
                    <Badge className="bg-green-100 text-green-800">
                      {p.activeSessions} signed in
                    </Badge>
                  )}
                </p>
                <p className="text-sm text-muted-foreground">
                  {p.email}
                  {p.phone ? ` · ${p.phone}` : ""}
                  {p.lastLoginAt
                    ? ` · last in ${new Date(p.lastLoginAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}`
                    : " · never signed in"}
                </p>
                {p.reportsToName && (
                  <p className="text-xs text-muted-foreground">Reports to {p.reportsToName}</p>
                )}
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1.5"
                  onClick={() => startEdit(p)}
                >
                  <Pencil className="size-3.5" /> Edit
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={busy}
                  onClick={() =>
                    run(
                      () =>
                        saveStaff({
                          id: p.id,
                          email: p.email,
                          name: p.name,
                          role: p.role,
                          phone: p.phone ?? "",
                          reportsToId: p.reportsToId,
                          isActive: !p.isActive,
                        }),
                      p.isActive ? "Deactivated." : "Reactivated.",
                    )
                  }
                >
                  {p.isActive ? "Deactivate" : "Reactivate"}
                </Button>
                {p.activeSessions > 0 && (
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={busy}
                    aria-label="Sign them out everywhere"
                    onClick={() => run(() => revokeSessions(p.id), "Signed out everywhere.")}
                  >
                    <ShieldOff className="size-4" />
                  </Button>
                )}
              </div>
            </div>
            {editing === p.id && <div className="mt-4">{form}</div>}
          </li>
        ))}
      </ul>

      {editing === "new" ? (
        form
      ) : (
        <Button
          variant="outline"
          className="gap-2"
          onClick={() => {
            setV(blank);
            setEditing("new");
          }}
        >
          <Plus className="size-4" /> Add someone
        </Button>
      )}
    </div>
  );
}
