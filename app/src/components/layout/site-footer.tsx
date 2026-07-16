import Link from "next/link";
import Image from "next/image";
import { Mail, MapPin, Phone, ShieldCheck, Truck } from "lucide-react";

import { mainNav, site } from "@/lib/site";

export function SiteFooter() {
  return (
    <footer className="mt-16 border-t bg-secondary/50 dark:bg-card">
      <div className="mx-auto grid max-w-[1500px] gap-10 px-4 py-12 sm:px-6 md:grid-cols-4">
        <div className="space-y-3 md:col-span-2 md:max-w-sm">
          <div className="flex items-center gap-2.5">
            <Image
              src="/brand/sl-logo.png"
              alt=""
              width={36}
              height={36}
              className="size-9 rounded-lg bg-white object-contain p-0.5 ring-1 ring-border"
            />
            <span className="font-heading text-lg font-bold">{site.company}</span>
          </div>
          <p className="text-sm text-muted-foreground">{site.description}</p>
          <p className="font-heading text-sm font-semibold text-primary dark:text-foreground">
            Research · Innovation · Impact
          </p>
        </div>

        <div>
          <h3 className="mb-3 text-sm font-semibold">Shop</h3>
          <ul className="space-y-2 text-sm text-muted-foreground">
            {mainNav.map((item) => (
              <li key={item.href}>
                <Link href={item.href} className="transition-colors hover:text-foreground">
                  {item.label}
                </Link>
              </li>
            ))}
            <li>
              <Link href="/account/orders" className="transition-colors hover:text-foreground">
                Track your order
              </Link>
            </li>
          </ul>
          <h3 className="mb-3 mt-6 text-sm font-semibold">Policies</h3>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li>
              <Link href="/policies/shipping" className="transition-colors hover:text-foreground">
                Shipping Policy
              </Link>
            </li>
            <li>
              <Link href="/policies/refund" className="transition-colors hover:text-foreground">
                Cancellation &amp; Refunds
              </Link>
            </li>
            <li>
              <Link href="/policies/terms" className="transition-colors hover:text-foreground">
                Terms &amp; Conditions
              </Link>
            </li>
            <li>
              <Link href="/policies/privacy" className="transition-colors hover:text-foreground">
                Privacy Policy
              </Link>
            </li>
            <li>
              <Link href="/contact" className="transition-colors hover:text-foreground">
                Contact Us
              </Link>
            </li>
          </ul>
        </div>

        <div>
          <h3 className="mb-3 text-sm font-semibold">Reach us</h3>
          <ul className="space-y-2.5 text-sm text-muted-foreground">
            <li className="flex items-start gap-2">
              <MapPin className="mt-0.5 size-4 shrink-0" /> {site.contact.address}
            </li>
            <li>
              <a href={`tel:${site.contact.phone.replace(/\s/g, "")}`} className="flex items-center gap-2 transition-colors hover:text-foreground">
                <Phone className="size-4 shrink-0" /> {site.contact.phone}
              </a>
            </li>
            <li>
              <a href={`mailto:${site.contact.email}`} className="flex items-center gap-2 transition-colors hover:text-foreground">
                <Mail className="size-4 shrink-0" /> {site.contact.email}
              </a>
            </li>
            <li>
              <a href={site.links.main} target="_blank" rel="noreferrer" className="transition-colors hover:text-foreground">
                theslpl.in
              </a>
            </li>
          </ul>
        </div>
      </div>

      <div className="border-t">
        <div className="mx-auto flex max-w-[1500px] flex-col items-center justify-between gap-3 px-4 py-4 text-xs text-muted-foreground sm:flex-row sm:px-6">
          <p>
            © {new Date().getFullYear()} {site.company}. All rights reserved.
          </p>
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1.5">
              <ShieldCheck className="size-4 text-saffron" /> Secure payments
            </span>
            <span className="flex items-center gap-1.5">
              <Truck className="size-4 text-saffron" /> Delivery across India
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
}
