import Link from "next/link";
import Image from "next/image";
import { ChevronDown, Package, ShoppingCart } from "lucide-react";

import { getSession } from "@/lib/auth";
import { mainNav, site } from "@/lib/site";
import { CartBadge } from "@/components/store/cart-badge";
import { DeliverTo } from "@/components/layout/deliver-to";
import { SearchBar } from "@/components/layout/search-bar";
import { ThemeToggle } from "@/components/theme-toggle";

/** Amazon-pattern header: brand top-left, search center, account/orders/cart top-right. */
export async function SiteHeader() {
  const session = await getSession();
  const firstName = session?.name.split(" ")[0];

  return (
    <header className="sticky top-0 z-40 bg-navy text-white shadow-md">
      {/* Row 1 */}
      <div className="mx-auto flex h-[60px] max-w-[1500px] items-center gap-2 px-3 sm:gap-3 sm:px-4">
        {/* Branding - top LEFT */}
        <Link
          href="/"
          aria-label={`${site.name} home`}
          className="flex shrink-0 items-center gap-2 rounded-md px-1.5 py-1 ring-white/60 transition hover:ring-1"
        >
          <Image
            src="/brand/sl-logo.png"
            alt=""
            width={38}
            height={38}
            className="size-9 rounded-md bg-white object-contain p-0.5"
            priority
          />
          <span className="flex flex-col leading-none">
            <span className="font-heading text-lg font-bold tracking-tight">SLPL Store</span>
            <span className="mt-0.5 hidden text-[10px] text-white/70 sm:block">Saaradaa Learknowations</span>
          </span>
        </Link>

        <div className="hidden lg:block">
          <DeliverTo />
        </div>

        {/* Search - center */}
        <SearchBar className="mx-2 hidden flex-1 md:block xl:mx-6" />

        {/* Right cluster */}
        <div className="ml-auto flex items-center gap-0.5 sm:gap-1 md:ml-0">
          <ThemeToggle className="text-white hover:bg-white/10 hover:text-white" />

          <Link
            href={session ? "/account" : "/login"}
            className="hidden flex-col rounded-md px-2 py-1 leading-tight ring-white/60 transition hover:ring-1 sm:flex"
          >
            <span className="text-[11px] text-white/70">Hello, {firstName ?? "sign in"}</span>
            <span className="flex items-center text-sm font-semibold">
              Account {!session && <ChevronDown className="ml-0.5 size-3" />}
            </span>
          </Link>

          <Link
            href="/account/orders"
            className="hidden flex-col rounded-md px-2 py-1 leading-tight ring-white/60 transition hover:ring-1 lg:flex"
          >
            <span className="text-[11px] text-white/70">Returns</span>
            <span className="text-sm font-semibold">& Orders</span>
          </Link>

          {/* Cart - top RIGHT */}
          <Link
            href="/cart"
            aria-label="Cart"
            className="relative flex items-end gap-1 rounded-md px-2 py-1.5 ring-white/60 transition hover:ring-1"
          >
            <span className="relative">
              <ShoppingCart className="size-7" strokeWidth={1.7} />
              <CartBadge className="absolute -right-1.5 -top-1.5 size-5 text-xs ring-2 ring-navy" />
            </span>
            <span className="hidden pb-0.5 text-sm font-semibold sm:block">Cart</span>
          </Link>
        </div>
      </div>

      {/* Mobile search */}
      <div className="px-3 pb-2 md:hidden">
        <SearchBar />
      </div>

      {/* Row 2 - category strip */}
      <nav aria-label="Categories" className="bg-white/10">
        <div className="no-scrollbar mx-auto flex max-w-[1500px] items-center gap-1 overflow-x-auto px-2 py-1 sm:px-3">
          <Link
            href="/categories"
            className="flex shrink-0 items-center gap-1 rounded px-2.5 py-1 text-sm font-semibold ring-white/60 transition hover:ring-1"
          >
            <Package className="size-4" /> All
          </Link>
          {mainNav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="shrink-0 rounded px-2.5 py-1 text-sm ring-white/60 transition hover:ring-1"
            >
              {item.label}
            </Link>
          ))}
          <Link href="/account" className="shrink-0 rounded px-2.5 py-1 text-sm ring-white/60 transition hover:ring-1">
            Track Order
          </Link>
        </div>
      </nav>
    </header>
  );
}
