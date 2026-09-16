import Link from "next/link";
import Image from "next/image";
import { redirect } from "next/navigation";
import { LayoutDashboard, LogOut, ScrollText, Store, UsersRound, Wallet } from "lucide-react";

import { Button } from "@/components/ui/button";
import { hasPin, isRememberedDevice } from "@/lib/expense-pin";
import { staffSignOut } from "@/lib/staff-actions";
import { getStaff, roleCan, type Capability } from "@/lib/staff-auth";

/**
 * The back office, gated per person and per capability. A screen asks what it
 * needs rather than naming roles, so adding a role later does not mean hunting
 * through pages.
 */
const nav: { href: string; label: string; icon: typeof Wallet; needs: Capability }[] = [
  { href: "/erp", label: "Overview", icon: LayoutDashboard, needs: "finance.read" },
  { href: "/erp/expenses", label: "Expenses", icon: Wallet, needs: "finance.read" },
  { href: "/erp/audit", label: "Audit", icon: ScrollText, needs: "staff.manage" },
  { href: "/erp/staff", label: "Staff", icon: UsersRound, needs: "staff.manage" },
];

export const metadata = {
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
  // The back office is the money side, so a role without finance access is told
  // so plainly rather than bounced to a login it cannot pass.
  if (!roleCan(staff.role, "finance.read")) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <div className="max-w-sm rounded-2xl border bg-card p-6 text-center">
          <h1 className="font-heading text-lg font-bold">No access to the back office</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            You are signed in as {staff.name}, {staff.role.toLowerCase().replace("_", " ")}. This
            area is for finance. Ask an owner if you need it.
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

  const visible = nav.filter((item) => roleCan(staff.role, item.needs));

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 border-b bg-navy text-white print:hidden">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3">
          <Link href="/erp" className="flex items-center gap-2.5">
            <Image
              src="/brand/sl-logo.png"
              alt=""
              width={28}
              height={28}
              className="size-7 rounded bg-white object-contain p-0.5"
            />
            <span className="font-heading text-base font-bold">SLPL Back office</span>
          </Link>
          <nav className="ml-auto flex items-center gap-1">
            {visible.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="flex items-center gap-1.5 rounded px-2.5 py-1.5 text-sm ring-white/60 transition hover:ring-1"
              >
                <item.icon className="size-4" /> <span className="hidden sm:inline">{item.label}</span>
              </Link>
            ))}
            {roleCan(staff.role, "store.manage") && (
              <Link
                href="/admin"
                className="flex items-center gap-1.5 rounded px-2.5 py-1.5 text-sm ring-white/60 transition hover:ring-1"
              >
                <Store className="size-4" /> <span className="hidden sm:inline">Store</span>
              </Link>
            )}
            <form action={staffSignOut}>
              <Button variant="ghost" size="sm" className="gap-1.5 text-white hover:bg-white/10">
                <LogOut className="size-4" />
                <span className="hidden sm:inline">
                  {staff.breakGlass ? "Owner" : staff.name.split(" ")[0]}
                </span>
              </Button>
            </form>
          </nav>
        </div>
      </header>

      {staff.breakGlass && (
        <p className="bg-saffron/20 px-4 py-2 text-center text-sm text-saffron-deep print:hidden">
          Signed in with the shared owner password. Use a personal account so the audit trail names
          you.
        </p>
      )}

      <main className="mx-auto max-w-6xl px-4 py-6 print:max-w-none print:px-0 print:py-0">
        {children}
      </main>
    </div>
  );
}
