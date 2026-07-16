import type { Metadata } from "next";
import { Clock, Mail, MapPin, MessageCircle, Phone } from "lucide-react";

import { Button } from "@/components/ui/button";
import { site } from "@/lib/site";

export const metadata: Metadata = { title: "Contact Us" };

export default function ContactPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <h1 className="font-heading text-3xl font-bold">Contact Us</h1>
      <p className="mt-2 text-muted-foreground">
        Questions about an order, bulk purchases for schools, or anything else:
        we answer every message.
      </p>

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        <div className="rounded-2xl border bg-card p-5">
          <Phone className="mb-2 size-5 text-saffron-deep" />
          <h2 className="font-heading font-semibold">Phone / WhatsApp</h2>
          <a href={`tel:${site.contact.phone.replace(/\s/g, "")}`} className="mt-1 block text-muted-foreground hover:text-foreground">
            {site.contact.phone}
          </a>
          <div className="mt-3 flex gap-2">
            <Button size="sm" asChild>
              <a href={`tel:${site.contact.phone.replace(/\s/g, "")}`}>Call now</a>
            </Button>
            <Button size="sm" variant="outline" className="gap-1.5" asChild>
              <a href={site.contact.whatsapp} target="_blank" rel="noreferrer">
                <MessageCircle className="size-4" /> WhatsApp
              </a>
            </Button>
          </div>
        </div>

        <div className="rounded-2xl border bg-card p-5">
          <Mail className="mb-2 size-5 text-saffron-deep" />
          <h2 className="font-heading font-semibold">Email</h2>
          <a href={`mailto:${site.contact.email}`} className="mt-1 block break-all text-muted-foreground hover:text-foreground">
            {site.contact.email}
          </a>
          <p className="mt-2 text-sm text-muted-foreground">We reply within 1 business day.</p>
        </div>

        <div className="rounded-2xl border bg-card p-5">
          <MapPin className="mb-2 size-5 text-saffron-deep" />
          <h2 className="font-heading font-semibold">Registered office</h2>
          <p className="mt-1 text-muted-foreground">
            {site.company}
            <br />
            {site.contact.address}
          </p>
        </div>

        <div className="rounded-2xl border bg-card p-5">
          <Clock className="mb-2 size-5 text-saffron-deep" />
          <h2 className="font-heading font-semibold">Support hours</h2>
          <p className="mt-1 text-muted-foreground">
            Monday to Saturday
            <br />
            9:30 am to 6:30 pm IST
          </p>
        </div>
      </div>

      <p className="mt-8 text-sm text-muted-foreground">
        For order issues, please keep your order number (starts with SLPL-) handy. You can also
        track any order from Your Account, then Returns and Orders.
      </p>
    </div>
  );
}
