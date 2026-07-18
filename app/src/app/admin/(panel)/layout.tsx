import Link from "next/link";
import Image from "next/image";
import { redirect } from "next/navigation";
import {
  BadgePercent,
  Boxes,
  LayoutDashboard,
  LogOut,
  Package,
  Radio,
  Settings,
  Store,
  Ticket,
  Truck,
  UsersRound,
} from "lucide-react";

import { isAdmin } from "@/lib/admin-auth";
import { adminLogout } from "@/lib/admin-actions";
import { Button } from "@/components/ui/button";

const nav = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/orders", label: "Orders", icon: Package },
  { href: "/admin/shipments", label: "Shipments", icon: Truck },
  { href: "/admin/products", label: "Products", icon: Boxes },
  { href: "/admin/users", label: "Customers", icon: UsersRound },
  { href: "/admin/coupons", label: "Coupons", icon: Ticket },
  { href: "/admin/sales", label: "Festival sales", icon: BadgePercent },
  { href: "/admin/services", label: "Services", icon: Radio },
  { href: "/admin/settings", label: "Settings", icon: Settings },
] as const;

export default async function AdminLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  if (!(await isAdmin())) redirect("/admin/login");

  return (
    <div className="flex min-h-screen">
      <aside className="hidden w-60 shrink-0 flex-col border-r bg-sidebar md:flex">
        <div className="flex items-center gap-2.5 border-b p-4">
          <Image
            src="/brand/sl-logo.png"
            alt=""
            width={36}
            height={36}
            className="size-9 rounded-lg bg-white object-contain p-0.5 ring-1 ring-border"
          />
          <div className="leading-tight">
            <p className="font-heading text-sm font-bold">SLPL Admin</p>
            <p className="text-xs text-muted-foreground">Store manager</p>
          </div>
        </div>
        <nav className="flex-1 space-y-1 p-3">
          {nav.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-sidebar-foreground/80 transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground"
            >
              <Icon className="size-4" /> {label}
            </Link>
          ))}
        </nav>
        <div className="space-y-1 border-t p-3">
          <Link
            href="/"
            target="_blank"
            className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-sidebar-foreground/80 transition-colors hover:bg-sidebar-accent"
          >
            <Store className="size-4" /> View store
          </Link>
          <form action={adminLogout}>
            <button
              type="submit"
              className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-sidebar-foreground/80 transition-colors hover:bg-sidebar-accent"
            >
              <LogOut className="size-4" /> Log out
            </button>
          </form>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Mobile top bar */}
        <header className="flex items-center justify-between gap-2 border-b p-3 md:hidden">
          <p className="font-heading font-bold">SLPL Admin</p>
          <div className="flex gap-1 overflow-x-auto">
            {nav.map(({ href, label }) => (
              <Button key={href} variant="ghost" size="sm" asChild>
                <Link href={href}>{label}</Link>
              </Button>
            ))}
          </div>
        </header>
        <main className="flex-1 p-4 sm:p-6">{children}</main>
      </div>
    </div>
  );
}
