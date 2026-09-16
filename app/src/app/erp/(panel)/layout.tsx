import Link from "next/link";
import Image from "next/image";
import { redirect } from "next/navigation";
import { LayoutDashboard, LogOut, Store, Wallet } from "lucide-react";

import { Button } from "@/components/ui/button";
import { adminLogout } from "@/lib/admin-actions";
import { isAdmin } from "@/lib/admin-auth";

/**
 * The back office. Gated by the same admin session as /admin for now; per-user
 * logins with roles arrive when the ERP's staff layer is merged in, and this
 * shell is where they will hang.
 */
const nav = [
  { href: "/erp", label: "Overview", icon: LayoutDashboard },
  { href: "/erp/expenses", label: "Expenses", icon: Wallet },
] as const;

export default async function ErpLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  if (!(await isAdmin())) redirect("/admin/login?next=/erp/expenses");

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
            {nav.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="flex items-center gap-1.5 rounded px-2.5 py-1.5 text-sm ring-white/60 transition hover:ring-1"
              >
                <item.icon className="size-4" /> <span className="hidden sm:inline">{item.label}</span>
              </Link>
            ))}
            <Link
              href="/admin"
              className="flex items-center gap-1.5 rounded px-2.5 py-1.5 text-sm ring-white/60 transition hover:ring-1"
            >
              <Store className="size-4" /> <span className="hidden sm:inline">Store admin</span>
            </Link>
            <form action={adminLogout}>
              <Button variant="ghost" size="sm" className="gap-1.5 text-white hover:bg-white/10">
                <LogOut className="size-4" /> <span className="hidden sm:inline">Log out</span>
              </Button>
            </form>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6 print:max-w-none print:px-0 print:py-0">
        {children}
      </main>
    </div>
  );
}
