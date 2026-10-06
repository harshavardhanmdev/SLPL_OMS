import Link from "next/link";
import Image from "next/image";
import { redirect } from "next/navigation";
import {
  BadgePercent,
  Backpack,
  Boxes,
  LayoutDashboard,
  LogOut,
  MessageSquareWarning,
  Package,
  Radio,
  Settings,
  Store,
  Ticket,
  Truck,
  UsersRound,
  type LucideIcon,
} from "lucide-react";

import { getStaff } from "@/lib/staff-auth";
import { ADMIN_SECTIONS, adminSectionsFor } from "@/lib/admin-gate";
import { adminLogout } from "@/lib/admin-actions";
import { Button } from "@/components/ui/button";

const icons: Record<(typeof ADMIN_SECTIONS)[number]["href"], LucideIcon> = {
  "/admin/orders": Package,
  "/admin/shipments": Truck,
  "/admin/grievances": MessageSquareWarning,
  "/admin/kits": Backpack,
  "/admin/products": Boxes,
  "/admin/users": UsersRound,
  "/admin/coupons": Ticket,
  "/admin/sales": BadgePercent,
  "/admin/services": Radio,
  "/admin/settings": Settings,
};

export default async function AdminLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const staff = await getStaff();
  if (!staff) redirect("/admin/login");
  // Each person sees only the sections their role can work in. Someone with
  // none at all, a CA say, has no business here.
  const sections = adminSectionsFor(staff.role);
  if (sections.length === 0) redirect("/admin/login");
  const nav = [
    { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
    ...sections.map((s) => ({ href: s.href, label: s.label, icon: icons[s.href] })),
  ];

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
