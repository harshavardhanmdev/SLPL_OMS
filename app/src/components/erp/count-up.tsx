"use client";

import { useEffect, useState } from "react";

import { formatINR } from "@/lib/money";

/**
 * A rupee figure that counts up from nothing when the screen opens, so the eye
 * lands on it. Screen readers get the real figure straight away, and anyone who
 * asked for less motion sees it jump to the end on the first frame.
 */
export function CountUp({ paise }: { paise: number }) {
  const [shown, setShown] = useState(0);

  useEffect(() => {
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let frame = 0;
    let start: number | null = null;
    const step = (t: number) => {
      start ??= t;
      const k = still ? 1 : Math.min(1, (t - start) / 900);
      const eased = 1 - (1 - k) ** 3;
      // Whole rupees on the way up, the exact figure at the end
      setShown(k < 1 ? Math.round((paise * eased) / 100) * 100 : paise);
      if (k < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [paise]);

  return (
    <>
      <span aria-hidden>{formatINR(shown)}</span>
      <span className="sr-only">{formatINR(paise)}</span>
    </>
  );
}
