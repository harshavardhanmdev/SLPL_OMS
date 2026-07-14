import Link from "next/link";
import Image from "next/image";
import { Search, ShoppingCart, User } from "lucide-react";

import { mainNav, site } from "@/lib/site";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ThemeToggle } from "@/components/theme-toggle";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b bg-background/90 backdrop-blur supports-[backdrop-filter]:bg-background/75">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-3 px-4 sm:px-6">
        <Link href="/" className="flex shrink-0 items-center gap-2.5" aria-label={`${site.name} home`}>
          <Image
            src="/brand/sl-logo.png"
            alt=""
            width={40}
            height={40}
            className="size-10 rounded-lg bg-white object-contain p-0.5 ring-1 ring-border"
            priority
          />
          <span className="hidden flex-col leading-tight sm:flex">
            <span className="font-heading text-lg font-bold tracking-tight">SLPL Store</span>
            <span className="text-[11px] text-muted-foreground">Saaradaa Learknowations</span>
          </span>
        </Link>

        <nav className="ml-4 hidden items-center gap-1 lg:flex" aria-label="Main">
          {mainNav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-md px-3 py-2 text-sm font-medium text-foreground/80 transition-colors hover:bg-secondary hover:text-foreground"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <form action="/search" className="ml-auto hidden max-w-xs flex-1 md:block" role="search">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="search"
              name="q"
              placeholder="Search books…"
              className="h-9 w-full rounded-full border border-input bg-muted/60 pl-9 pr-4 text-sm outline-none transition-colors focus:border-ring focus:bg-background"
            />
          </div>
        </form>

        {/* Cart lives top-right on desktop (Amazon muscle memory); mobile uses the bottom nav */}
        <div className="ml-auto flex items-center gap-1 md:ml-2">
          <Button variant="ghost" size="icon" className="md:hidden" asChild>
            <Link href="/search" aria-label="Search">
              <Search className="size-5" />
            </Link>
          </Button>
          <ThemeToggle />
          <Button variant="ghost" size="icon" className="hidden md:inline-flex" asChild>
            <Link href="/account" aria-label="Account">
              <User className="size-5" />
            </Link>
          </Button>
          <Button variant="ghost" className="relative hidden gap-2 md:inline-flex" asChild>
            <Link href="/cart" aria-label="Cart">
              <ShoppingCart className="size-5" />
              <span className="text-sm font-medium">Cart</span>
              <Badge
                data-cart-badge
                className="absolute -right-1 -top-1 hidden size-5 justify-center rounded-full bg-saffron p-0 text-xs font-bold text-navy"
              >
                0
              </Badge>
            </Link>
          </Button>
        </div>
      </div>
    </header>
  );
}
