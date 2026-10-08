"use client";

import * as React from "react";
import Image from "next/image";
import Link, { useLinkStatus } from "next/link";
import { usePathname } from "next/navigation";
import {
  BadgeIndianRupee,
  Bell,
  Boxes,
  Building2,
  FileSignature,
  Fingerprint,
  Gift,
  Handshake,
  Landmark,
  LayoutDashboard,
  LogOut,
  Menu,
  Monitor,
  Newspaper,
  Package,
  Plus,
  ReceiptText,
  ScrollText,
  Store,
  Tags,
  Target,
  TrendingUp,
  Truck,
  UsersRound,
  Wallet,
} from "lucide-react";

import { InstallApp } from "@/components/erp/install-app";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

/**
 * The back office frame: a grouped sidebar on a desktop, a top bar with a
 * slide-in menu and a thumb-reach bar on a phone.
 *
 * The header used to carry every screen in one row, which stopped fitting
 * once sales arrived. Grouping them is what lets the list keep growing.
 *
 * Icons travel from the server as names, because a component cannot cross
 * from a server layout into a client one.
 */

const ICONS = {
  overview: LayoutDashboard,
  sales: TrendingUp,
  schools: Building2,
  quotations: FileSignature,
  invoices: ReceiptText,
  challans: Truck,
  payments: BadgeIndianRupee,
  samples: Package,
  gifts: Gift,
  targets: Target,
  prices: Tags,
  expenses: Wallet,
  stock: Boxes,
  subs: Newspaper,
  digital: Monitor,
  staff: UsersRound,
  audit: ScrollText,
  company: Landmark,
  store: Store,
  plus: Plus,
  bell: Bell,
  fingerprint: Fingerprint,
  vendors: Handshake,
} as const;

export type NavIcon = keyof typeof ICONS;
export type NavItem = { href: string; label: string; icon: NavIcon; badge?: number };
export type NavGroup = { label: string | null; items: NavItem[] };

/** A count that wants attention, pulsing gently so it is noticed but not shouted. */
function CountBadge({ count, className }: { count?: number; className?: string }) {
  if (!count) return null;
  return (
    <span
      className={cn(
        "inline-flex min-w-5 items-center justify-center rounded-full bg-saffron px-1.5 text-[11px] font-bold leading-5 text-navy tabular-nums motion-safe:animate-pulse",
        className,
      )}
    >
      {count > 99 ? "99+" : count}
    </span>
  );
}

function isActive(pathname: string, href: string) {
  if (href === "/erp") return pathname === "/erp";
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** A thin bar under the link while its page loads, so a tap always answers. */
function Pending() {
  const { pending } = useLinkStatus();
  return (
    <span
      aria-hidden
      className={cn(
        "absolute inset-x-3 bottom-0.5 h-0.5 origin-left rounded-full bg-saffron transition-opacity",
        pending ? "animate-pulse opacity-100" : "opacity-0",
      )}
    />
  );
}

function NavLinks({ groups, onNavigate }: { groups: NavGroup[]; onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <nav className="space-y-4">
      {groups.map((group, g) => (
        <div key={group.label ?? g}>
          {group.label && (
            <p className="mb-1.5 px-3 text-[11px] font-semibold uppercase tracking-wider text-white/45">
              {group.label}
            </p>
          )}
          <ul className="space-y-0.5">
            {group.items.map((item) => {
              const Icon = ICONS[item.icon];
              const active = isActive(pathname, item.href);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={onNavigate}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "group relative flex items-center gap-3 rounded-lg px-3 py-1.5 text-sm font-medium transition-all duration-200",
                      active
                        ? "bg-white/12 text-white shadow-[inset_3px_0_0_var(--saffron)]"
                        : "text-white/75 hover:translate-x-0.5 hover:bg-white/7 hover:text-white",
                    )}
                  >
                    <Icon
                      className={cn(
                        "size-4 shrink-0 transition-colors",
                        active ? "text-saffron" : "text-white/60 group-hover:text-white",
                      )}
                    />
                    {item.label}
                    <CountBadge count={item.badge} className="ml-auto" />
                    <Pending />
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}

function Brand() {
  return (
    <Link href="/erp" className="flex items-center gap-2.5">
      <Image
        src="/brand/sl-logo.png"
        alt=""
        width={32}
        height={32}
        className="size-8 rounded-lg bg-white object-contain p-0.5"
      />
      <span className="leading-tight">
        <span className="block font-heading text-sm font-bold">SLPL</span>
        <span className="block text-[11px] text-white/60">Back office</span>
      </span>
    </Link>
  );
}

function Person({
  name,
  role,
  signOut,
}: {
  name: string;
  role: string;
  signOut: () => Promise<void>;
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl bg-white/6 p-2.5">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-saffron font-heading text-sm font-bold text-navy">
        {name.slice(0, 1).toUpperCase()}
      </span>
      <span className="min-w-0 flex-1 leading-tight">
        <span className="block truncate text-sm font-semibold">{name}</span>
        <span className="block truncate text-[11px] text-white/55 first-letter:uppercase">{role}</span>
      </span>
      <form action={signOut}>
        <button
          type="submit"
          className="rounded-md p-2 text-white/70 transition hover:bg-white/10 hover:text-white"
          aria-label="Sign out"
          title="Sign out"
        >
          <LogOut className="size-4" />
        </button>
      </form>
    </div>
  );
}

export function ErpShell({
  groups,
  quick,
  name,
  role,
  signOut,
  banner,
  children,
}: {
  groups: NavGroup[];
  /** Up to three screens for the phone's bottom bar. */
  quick: NavItem[];
  name: string;
  role: string;
  signOut: () => Promise<void>;
  banner?: React.ReactNode;
  children: React.ReactNode;
}) {
  const [open, setOpen] = React.useState(false);
  const pathname = usePathname();

  return (
    <div className="min-h-screen bg-background lg:flex">
      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col bg-navy text-white lg:flex print:hidden">
        <div className="px-4 pt-4 pb-3">
          <Brand />
        </div>
        <div className="no-scrollbar flex-1 overflow-y-auto px-3 pb-4">
          <NavLinks groups={groups} />
        </div>
        <div className="space-y-2 border-t border-white/10 p-3">
          <InstallApp variant="menu" />
          <Person name={name} role={role} signOut={signOut} />
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Phone top bar */}
        <header className="sticky top-0 z-30 flex items-center justify-between gap-3 bg-navy px-4 py-3 text-white shadow-md lg:hidden print:hidden">
          <Brand />
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="rounded-lg p-2 transition hover:bg-white/10 active:scale-95"
            aria-label="Open the menu"
          >
            <Menu className="size-5" />
          </button>
        </header>

        <Sheet open={open} onOpenChange={setOpen}>
          <SheetContent
            side="left"
            className="w-72 border-none bg-navy p-0 text-white [&>button]:text-white"
          >
            <SheetTitle className="sr-only">Back office menu</SheetTitle>
            <div className="flex h-full flex-col">
              <div className="px-4 pt-5 pb-4">
                <Brand />
              </div>
              <div className="flex-1 overflow-y-auto px-3 pb-4">
                <NavLinks groups={groups} onNavigate={() => setOpen(false)} />
              </div>
              <div className="space-y-2 border-t border-white/10 p-3">
                <InstallApp variant="menu" />
                <Person name={name} role={role} signOut={signOut} />
              </div>
            </div>
          </SheetContent>
        </Sheet>

        {banner}

        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 pb-24 sm:px-6 lg:pb-8 print:max-w-none print:px-0 print:py-0">
          {children}
        </main>

        {/* Phone bottom bar, for the screens used between school visits */}
        {quick.length > 0 && (
          <nav className="fixed inset-x-0 bottom-0 z-30 border-t bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden print:hidden">
            <ul className="mx-auto flex max-w-md items-stretch justify-around">
              {quick.map((item) => {
                const Icon = ICONS[item.icon];
                const active = isActive(pathname, item.href);
                return (
                  <li key={item.href} className="flex-1">
                    <Link
                      href={item.href}
                      className={cn(
                        "relative flex flex-col items-center gap-0.5 py-2 text-[11px] font-medium transition active:scale-95",
                        active ? "text-saffron-deep" : "text-muted-foreground",
                      )}
                    >
                      <Icon className="size-5" />
                      <CountBadge count={item.badge} className="absolute top-1 left-1/2 ml-1.5" />
                      {item.label}
                      <Pending />
                    </Link>
                  </li>
                );
              })}
              <li className="flex-1">
                <button
                  type="button"
                  onClick={() => setOpen(true)}
                  className="flex w-full flex-col items-center gap-0.5 py-2 text-[11px] font-medium text-muted-foreground transition active:scale-95"
                >
                  <Menu className="size-5" />
                  More
                </button>
              </li>
            </ul>
          </nav>
        )}
      </div>
    </div>
  );
}
