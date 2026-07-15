"use client";

import * as React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";

/**
 * Horizontally scrollable rail (touch-swipe on mobile, arrow buttons on
 * desktop) - used for the home "New Releases" strip.
 */
export function ProductRail({ children }: { children: React.ReactNode }) {
  const ref = React.useRef<HTMLDivElement>(null);

  function scrollBy(dir: 1 | -1) {
    ref.current?.scrollBy({ left: dir * (ref.current.clientWidth * 0.8), behavior: "smooth" });
  }

  return (
    <div className="group/rail relative">
      <div
        ref={ref}
        className="no-scrollbar -mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto scroll-smooth px-4 pb-1 sm:-mx-6 sm:px-6"
      >
        {React.Children.map(children, (child) => (
          <div className="w-[44vw] shrink-0 snap-start sm:w-[200px] md:w-[220px]">{child}</div>
        ))}
      </div>
      <Button
        variant="secondary"
        size="icon"
        aria-label="Scroll left"
        onClick={() => scrollBy(-1)}
        className="absolute -left-3 top-1/3 z-10 hidden size-9 rounded-full border shadow-md transition-opacity md:inline-flex md:opacity-0 md:group-hover/rail:opacity-100"
      >
        <ChevronLeft className="size-5" />
      </Button>
      <Button
        variant="secondary"
        size="icon"
        aria-label="Scroll right"
        onClick={() => scrollBy(1)}
        className="absolute -right-3 top-1/3 z-10 hidden size-9 rounded-full border shadow-md transition-opacity md:inline-flex md:opacity-0 md:group-hover/rail:opacity-100"
      >
        <ChevronRight className="size-5" />
      </Button>
    </div>
  );
}
