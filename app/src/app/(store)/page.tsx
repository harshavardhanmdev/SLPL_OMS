import Link from "next/link";
import { ArrowRight, BookOpen } from "lucide-react";

import { Button } from "@/components/ui/button";
import { bookCategories } from "@/lib/site";

export default function HomePage() {
  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6">
      {/* Placeholder hero — the full home page ships in milestone M3 */}
      <section className="flex flex-col items-center gap-6 py-24 text-center">
        <span className="rounded-full bg-accent px-4 py-1.5 text-sm font-medium text-accent-foreground">
          Store under construction — launching soon
        </span>
        <h1 className="max-w-2xl text-balance font-heading text-4xl font-bold tracking-tight sm:text-5xl">
          Many publish books. <span className="text-saffron-deep">We build futures.</span>
        </h1>
        <p className="max-w-xl text-pretty text-muted-foreground">
          School textbooks from Pre-Primary to Grade 12, novels, poems and class
          bundles — from Saaradaa Learknowations, delivered across India.
        </p>
        <Button size="lg" className="gap-2" asChild>
          <Link href="/categories">
            Browse categories <ArrowRight className="size-4" />
          </Link>
        </Button>
      </section>

      <section className="grid gap-4 pb-24 sm:grid-cols-2 lg:grid-cols-4">
        {bookCategories.slice(0, 4).map((cat) => (
          <Link
            key={cat.slug}
            href={`/category/${cat.slug}`}
            className="group rounded-xl border bg-card p-5 transition-all hover:-translate-y-0.5 hover:border-saffron hover:shadow-md"
          >
            <BookOpen className="mb-3 size-6 text-saffron-deep" />
            <h2 className="font-heading font-semibold">{cat.name}</h2>
            <p className="text-sm text-muted-foreground">
              {cat.series ? `${cat.series} · ${cat.grades}` : cat.grades}
            </p>
          </Link>
        ))}
      </section>
    </div>
  );
}
