import { redirect } from "next/navigation";
import { LogOut } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ErpShell, type NavGroup, type NavItem } from "@/components/erp/erp-shell";
import { canEnterAdmin } from "@/lib/admin-gate";
import { approvalCount } from "@/lib/approvals";
import { hasPin, isRememberedDevice } from "@/lib/expense-pin";
import { roleLabel } from "@/lib/roles";
import { staffSignOut } from "@/lib/staff-actions";
import { canEnterErp, getStaff, roleCan, type Capability } from "@/lib/staff-auth";
import { DemoBar } from "@/components/erp/demo-bar";

/**
 * The back office, gated per person and per capability. A screen asks what it
 * needs rather than naming roles, so adding a role later does not mean hunting
 * through pages.
 */
type Entry = NavItem & { needs: Capability | "erp.enter" | "admin.enter" };

const groups: { label: string | null; items: Entry[] }[] = [
  {
    label: null,
    items: [
      { href: "/erp", label: "Overview", icon: "overview", needs: "erp.enter" },
      { href: "/erp/claims", label: "My expenses", icon: "expenses", needs: "erp.enter" },
      { href: "/erp/passkeys", label: "Fingerprint sign-in", icon: "fingerprint", needs: "erp.enter" },
    ],
  },
  {
    label: "Sales",
    items: [
      { href: "/erp/sales", label: "Sales home", icon: "sales", needs: "crm.read" },
      { href: "/erp/approvals", label: "Approvals", icon: "bell", needs: "crm.read" },
      { href: "/erp/organizations", label: "Schools", icon: "schools", needs: "crm.read" },
      { href: "/erp/quotations", label: "Quotations", icon: "quotations", needs: "quotes.read" },
      { href: "/erp/invoices", label: "Invoices", icon: "invoices", needs: "crm.read" },
      { href: "/erp/challans", label: "Delivery challans", icon: "challans", needs: "crm.read" },
      { href: "/erp/samples", label: "Samples", icon: "samples", needs: "crm.read" },
      { href: "/erp/gifts", label: "Gifts", icon: "gifts", needs: "crm.read" },
      { href: "/erp/targets", label: "Targets", icon: "targets", needs: "crm.read" },
      { href: "/erp/prices", label: "Price list", icon: "prices", needs: "quotes.read" },
    ],
  },
  {
    label: "Money",
    items: [
      { href: "/erp/payments", label: "Payments in", icon: "payments", needs: "finance.read" },
      { href: "/erp/expenses", label: "Expenses", icon: "expenses", needs: "finance.read" },
    ],
  },
  {
    label: "Stock and titles",
    items: [
      { href: "/erp/stock", label: "Stock", icon: "stock", needs: "finance.read" },
      { href: "/erp/subscriptions", label: "Subscriptions", icon: "subs", needs: "finance.read" },
      { href: "/erp/digital", label: "Digital editions", icon: "digital", needs: "finance.read" },
    ],
  },
  {
    label: "Admin",
    items: [
      { href: "/erp/staff", label: "Staff", icon: "staff", needs: "staff.manage" },
      { href: "/erp/audit", label: "Audit trail", icon: "audit", needs: "staff.manage" },
      { href: "/erp/company", label: "Company profile", icon: "company", needs: "staff.manage" },
      { href: "/admin", label: "Online store", icon: "store", needs: "admin.enter" },
    ],
  },
];

export const metadata = {
  manifest: "/erp.webmanifest",
  appleWebApp: { capable: true, title: "SLPL", statusBarStyle: "black-translucent" as const },
  icons: { apple: "/brand/apple-touch-icon.png" },
};

export default async function ErpLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const staff = await getStaff();
  if (!staff) {
    // A phone that has been trusted gets the PIN pad; anything else signs in
    const quick = (await isRememberedDevice()) && (await hasPin());
    redirect(quick ? "/erp/unlock?next=/erp/expenses" : "/erp/signin?next=/erp");
  }
  // Sales live here too now, so the gate asks whether they have any business in
  // the back office at all rather than whether they can see money.
  if (!canEnterErp(staff.role)) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <div className="max-w-sm rounded-2xl border bg-card p-6 text-center">
          <h1 className="font-heading text-lg font-bold">No access to the back office</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            You are signed in as {staff.name}, {staff.role.toLowerCase().replace("_", " ")}. Ask an
            owner if you need this.
          </p>
          <form action={staffSignOut} className="mt-4">
            <Button variant="outline" className="w-full gap-2">
              <LogOut className="size-4" /> Sign out
            </Button>
          </form>
        </div>
      </div>
    );
  }

  // Waiting for an approver, or sent back to everyone else
  const approvals = roleCan(staff.role, "crm.read") ? await approvalCount(staff) : 0;
  const approver = roleCan(staff.role, "invoices.approve");

  const visible: NavGroup[] = groups
    .map((g) => ({
      label: g.label,
      items: g.items
        .filter((i) =>
          i.needs === "erp.enter"
            ? true
            : i.needs === "admin.enter"
              ? canEnterAdmin(staff.role)
              : roleCan(staff.role, i.needs),
        )
        .map(({ href, label, icon }) => ({
          href,
          label,
          icon,
          badge: href === "/erp/approvals" ? approvals : undefined,
        })),
    }))
    .filter((g) => g.items.length > 0);

  // The phone bar carries what each person reaches for between visits
  const quick: NavItem[] = roleCan(staff.role, "crm.write")
    ? [
        { href: "/erp/sales", label: "Today", icon: "sales" },
        approver
          ? { href: "/erp/approvals", label: "Approvals", icon: "bell", badge: approvals }
          : { href: "/erp/organizations", label: "Schools", icon: "schools" },
        { href: "/erp/visits/new", label: "Log visit", icon: "plus" },
      ]
    : roleCan(staff.role, "finance.read")
      ? [
          { href: "/erp", label: "Overview", icon: "overview" },
          { href: "/erp/expenses", label: "Expenses", icon: "expenses" },
          { href: "/erp/stock", label: "Stock", icon: "stock" },
        ]
      : [];

  return (
    <ErpShell
      groups={visible}
      quick={quick}
      name={staff.breakGlass ? "Owner" : staff.name}
      role={staff.breakGlass ? "shared password" : roleLabel(staff.role)}
      signOut={staffSignOut}
      banner={
        process.env.DEMO_MODE === "1" ? (
          <DemoBar />
        ) : staff.breakGlass ? (
          <p className="bg-saffron/20 px-4 py-2 text-center text-sm text-saffron-deep print:hidden">
            Signed in with the shared owner password. Use a personal account so the audit trail
            names you.
          </p>
        ) : null
      }
    >
      {children}
    </ErpShell>
  );
}
