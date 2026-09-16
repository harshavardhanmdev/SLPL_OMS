"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus, ShieldOff } from "lucide-react";
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
  { value: "SALES", label: "Sales, orders and customers" },
  { value: "WAREHOUSE", label: "Warehouse, shipments and stock" },
  { value: "SUPPORT", label: "Support, grievances only" },
  { value: "CA_READONLY", label: "CA, reads finance and changes nothing" },
];

type Person = {
  id: string;
  email: string;
  name: string;
  role: string;
  isActive: boolean;
  lastLoginAt: string | null;
  activeSessions: number;
};

const blank = { email: "", name: "", role: "ACCOUNTS", password: "", isActive: true };

export function StaffManager({ people }: { people: Person[] }) {
  const router = useRouter();
  const [adding, setAdding] = React.useState(people.length === 0);
  const [v, setV] = React.useState(blank);
  const [busy, setBusy] = React.useState(false);

  async function run(fn: () => Promise<{ ok?: boolean; error?: string }>, done: string) {
    setBusy(true);
    try {
      const res = await fn();
      if (res.error) toast.error(res.error === "FORBIDDEN" ? "Only an owner can do that." : res.error);
      else {
        toast.success(done);
        setV(blank);
        setAdding(false);
        router.refresh();
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      <ul className="divide-y rounded-2xl border bg-card">
        {people.map((p) => (
          <li key={p.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
            <div className="min-w-0">
              <p className="flex flex-wrap items-center gap-2 font-medium">
                {p.name}
                <Badge variant="secondary">{p.role}</Badge>
                {!p.isActive && <Badge variant="outline">inactive</Badge>}
                {p.activeSessions > 0 && (
                  <Badge className="bg-green-100 text-green-800">
                    {p.activeSessions} signed in
                  </Badge>
                )}
              </p>
              <p className="text-sm text-muted-foreground">
                {p.email}
                {p.lastLoginAt
                  ? ` · last in ${new Date(p.lastLoginAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}`
                  : " · never signed in"}
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                disabled={busy}
                onClick={() =>
                  run(
                    () => saveStaff({ id: p.id, email: p.email, name: p.name, role: p.role, isActive: !p.isActive }),
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
          </li>
        ))}
      </ul>

      {adding ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void run(() => saveStaff(v), "Account created.");
          }}
          className="space-y-4 rounded-2xl border bg-card p-5"
        >
          <h2 className="font-heading font-semibold">Add someone</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="st-name">Name</Label>
              <Input
                id="st-name"
                value={v.name}
                onChange={(e) => setV({ ...v, name: e.target.value })}
                className="h-11"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="st-email">Email</Label>
              <Input
                id="st-email"
                type="email"
                value={v.email}
                onChange={(e) => setV({ ...v, email: e.target.value })}
                className="h-11"
                required
              />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="st-role">Role</Label>
              <select
                id="st-role"
                className={selectClass}
                value={v.role}
                onChange={(e) => setV({ ...v, role: e.target.value })}
              >
                {ROLES.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="st-pw">Password</Label>
              <Input
                id="st-pw"
                type="password"
                value={v.password}
                onChange={(e) => setV({ ...v, password: e.target.value })}
                placeholder="At least 8 characters"
                className="h-11"
                required
              />
            </div>
          </div>
          <div className="flex gap-2">
            <Button type="submit" disabled={busy} className="gap-2">
              {busy && <Loader2 className="size-4 animate-spin" />} Create account
            </Button>
            <Button type="button" variant="ghost" onClick={() => setAdding(false)}>
              Cancel
            </Button>
          </div>
        </form>
      ) : (
        <Button variant="outline" className="gap-2" onClick={() => setAdding(true)}>
          <Plus className="size-4" /> Add someone
        </Button>
      )}
    </div>
  );
}
