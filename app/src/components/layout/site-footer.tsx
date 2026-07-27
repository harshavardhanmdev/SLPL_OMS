import Link from "next/link";
import Image from "next/image";
import { Mail, MapPin, Phone, ShieldCheck, Truck } from "lucide-react";

import { mainNav, site } from "@/lib/site";

export function SiteFooter() {
  return (
    <footer className="mt-16 border-t bg-secondary/50 dark:bg-card">
      <div className="mx-auto grid max-w-[1500px] gap-x-8 gap-y-8 px-4 py-9 sm:px-6 md:grid-cols-4 lg:grid-cols-5">
        <div className="space-y-2 md:col-span-4 md:max-w-md lg:col-span-2">
          <div className="flex items-center gap-2.5">
            <Image
              src="/brand/sl-logo.png"
              alt=""
              width={32}
              height={32}
              className="size-8 rounded-lg bg-white object-contain p-0.5 ring-1 ring-border"
            />
            <span className="font-heading text-base font-bold">{site.company}</span>
          </div>
          <p className="text-xs leading-relaxed text-muted-foreground">{site.description}</p>
          <p className="font-heading text-xs font-semibold text-primary dark:text-foreground">
            Research · Innovation · Impact
          </p>
        </div>

        <div>
          <h3 className="mb-2 text-sm font-semibold">Shop</h3>
          <ul className="space-y-1.5 text-sm text-muted-foreground">
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
            <li>
              <Link href="/advertise" className="transition-colors hover:text-foreground">
                Advertise with us
              </Link>
            </li>
          </ul>
        </div>

        <div>
          <h3 className="mb-2 text-sm font-semibold">Policies</h3>
          <ul className="space-y-1.5 text-sm text-muted-foreground">
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
            <li>
              <Link href="/about" className="transition-colors hover:text-foreground">
                About Us
              </Link>
            </li>
          </ul>
        </div>

        <div>
          <h3 className="mb-2 text-sm font-semibold">Reach us</h3>
          <ul className="space-y-1.5 text-sm text-muted-foreground">
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
        <div className="mx-auto flex max-w-[1500px] flex-col items-center justify-between gap-2 px-4 py-3 text-xs text-muted-foreground sm:flex-row sm:px-6">
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
