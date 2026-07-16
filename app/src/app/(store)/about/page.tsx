import type { Metadata } from "next";
import Link from "next/link";
import { BookOpen, FlaskConical, GraduationCap, Landmark, Truck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { site } from "@/lib/site";

export const metadata: Metadata = {
  title: "About Us",
  description:
    "Saaradaa Learknowations Pvt Ltd publishes research-oriented school textbooks, novels and UPSC Civils foundation material, delivered across India.",
};

export default function AboutPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <h1 className="font-heading text-3xl font-bold">About Us</h1>

      <div className="mt-5 space-y-5 leading-relaxed text-muted-foreground">
        <p>
          <strong className="text-foreground">{site.company}</strong> is an education company
          based in Hyderabad, Telangana. We research, write, publish and distribute school
          learning material: the Baby Steps series for Nursery, LKG and UKG, the Little Leaps
          series for Grades 1 to 5, the Skill Builders series for Grades 6 to 10, novels and
          poetry from our publishing house, and foundation material for UPSC Civil Services
          aspirants through Saaradaa&apos;s Civil Services Aspirant Program.
        </p>
        <p>
          Our books are research-oriented by design: every chapter opens with a real-life hook,
          builds concepts step by step, and closes with skill checks students can self-correct.
          Titles are progressively revised with classroom feedback from partner schools across
          Telangana and Andhra Pradesh, and connect to digital lessons on the SLPL Learning
          Management System through QR codes.
        </p>
        <p>
          {site.name} (store.theslpl.in) is our official online store. Orders are packed at our
          Hyderabad facility and delivered across India through reputed courier partners, with
          online payments processed securely by Razorpay.
        </p>
        <p>
          Beyond books, we partner with schools through a nine-point academic ecosystem
          including SL Radio (a private internet radio station for schools), English
          communication workshops, the peer-reviewed Saaradaa Journal of Interdisciplinary
          Studies (ISSN 3139-4019), and the SL LMS.
        </p>
      </div>

      <div className="mt-8 grid gap-3 sm:grid-cols-2">
        {[
          { icon: GraduationCap, text: "Nursery to Grade 12, every subject" },
          { icon: FlaskConical, text: "Research-first learning material" },
          { icon: Landmark, text: "UPSC Civils foundation program" },
          { icon: Truck, text: "Delivery across India" },
        ].map(({ icon: Icon, text }) => (
          <div key={text} className="flex items-center gap-3 rounded-xl border bg-card p-4 text-sm font-medium">
            <Icon className="size-5 shrink-0 text-saffron-deep" /> {text}
          </div>
        ))}
      </div>

      <div className="mt-8 rounded-2xl border bg-secondary/60 p-5 dark:bg-card">
        <h2 className="font-heading text-lg font-semibold">Company details</h2>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          {site.company}
          <br />
          {site.contact.address}
          <br />
          Phone: {site.contact.phone} · Email: {site.contact.email}
          <br />
          Websites: theslpl.in (company) · store.theslpl.in (store) · e2eindia.org
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button size="sm" asChild>
            <Link href="/categories">
              <BookOpen className="size-4" /> Browse our books
            </Link>
          </Button>
          <Button size="sm" variant="outline" asChild>
            <Link href="/contact">Contact us</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
