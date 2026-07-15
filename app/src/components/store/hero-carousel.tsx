"use client";

import * as React from "react";
import Link from "next/link";
import Image from "next/image";
import { ChevronLeft, ChevronRight } from "lucide-react";

export type HeroItem = { image: string; title: string; href: string };

/**
 * Plain, dependable hero carousel: scroll-snap covers, arrow buttons,
 * gentle auto-advance that pauses while the user is interacting.
 */
export function HeroCarousel({ items }: { items: HeroItem[] }) {
  const railRef = React.useRef<HTMLDivElement>(null);
  const pausedRef = React.useRef(false);

  const step = React.useCallback((dir: 1 | -1) => {
    const rail = railRef.current;
    if (!rail) return;
    const card = rail.querySelector<HTMLElement>("[data-card]");
    const width = (card?.offsetWidth ?? 240) + 16;
    const atEnd = rail.scrollLeft + rail.clientWidth >= rail.scrollWidth - width / 2;
    if (dir === 1 && atEnd) rail.scrollTo({ left: 0, behavior: "smooth" });
    else rail.scrollBy({ left: dir * width, behavior: "smooth" });
  }, []);

  React.useEffect(() => {
    const timer = setInterval(() => {
      if (!pausedRef.current && document.visibilityState === "visible") step(1);
    }, 3500);
    return () => clearInterval(timer);
  }, [step]);

  if (items.length === 0) return null;

  return (
    <div
      className="group/hero relative"
      onPointerEnter={() => (pausedRef.current = true)}
      onPointerLeave={() => (pausedRef.current = false)}
      onTouchStart={() => (pausedRef.current = true)}
    >
      <div
        ref={railRef}
        className="no-scrollbar flex snap-x snap-mandatory gap-4 overflow-x-auto scroll-smooth pb-1"
      >
        {items.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            data-card
            className="group w-[calc(50%-0.5rem)] shrink-0 snap-start overflow-hidden rounded-2xl border bg-card shadow-sm transition-all hover:-translate-y-0.5 hover:border-saffron/60 hover:shadow-lg sm:w-[calc(33.333%-0.75rem)]"
          >
            <span className="relative block aspect-[3/4]">
              <Image
                src={item.image}
                alt={item.title}
                fill
                sizes="(max-width: 640px) 45vw, (max-width: 1024px) 30vw, 260px"
                className="object-cover transition-transform duration-300 group-hover:scale-[1.03]"
              />
            </span>
            <span className="line-clamp-1 block px-3 py-2.5 text-sm font-medium">{item.title}</span>
          </Link>
        ))}
      </div>

      <button
        type="button"
        aria-label="Previous books"
        onClick={() => step(-1)}
        className="absolute -left-3 top-1/2 z-10 hidden size-10 -translate-y-1/2 place-items-center rounded-full border bg-background shadow-md transition hover:bg-secondary sm:grid"
      >
        <ChevronLeft className="size-5" />
      </button>
      <button
        type="button"
        aria-label="Next books"
        onClick={() => step(1)}
        className="absolute -right-3 top-1/2 z-10 hidden size-10 -translate-y-1/2 place-items-center rounded-full border bg-background shadow-md transition hover:bg-secondary sm:grid"
      >
        <ChevronRight className="size-5" />
      </button>
    </div>
  );
}
