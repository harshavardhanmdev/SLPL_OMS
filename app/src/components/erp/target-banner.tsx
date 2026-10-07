import { Sparkles } from "lucide-react";

import { CountUp } from "@/components/erp/count-up";
import { formatINR } from "@/lib/money";
import type { Pace } from "@/lib/sales-summary";

/**
 * Target, achieved, and how long is left.
 *
 * The bar carries a marker showing where the calendar says you should be, so
 * "60% done" means something. It pulses only when behind pace, because a
 * banner that flashes every day is a banner nobody looks at. A met target
 * gets a green glow and a ribbon, so the good news is as easy to spot.
 */
export function TargetBanner({
  pace,
  title,
  subtitle,
}: {
  pace: Pace;
  title: string;
  subtitle?: string;
}) {
  const pct = Math.min(1, Math.max(0, pace.percent));
  const short = Math.max(0, pace.target - pace.achieved);
  const met = pace.target > 0 && pace.achieved >= pace.target;

  return (
    <div
      className={`rounded-2xl border p-4 sm:p-5 ${
        met
          ? "erp-glow-met border-green-600/50 bg-green-50/60 dark:bg-green-950/20"
          : pace.behind
            ? "erp-glow-behind border-saffron bg-saffron/10"
            : "border-border bg-card"
      }`}
    >
      {met && (
        <p className="erp-shimmer mb-3 inline-flex items-center gap-1.5 rounded-full bg-green-600 px-3 py-1 text-xs font-semibold text-white">
          <Sparkles className="erp-twinkle size-3.5" aria-hidden /> Target achieved
        </p>
      )}
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">{title}</p>
          <p className="font-heading text-2xl font-bold sm:text-3xl">
            <CountUp paise={pace.achieved} />
            <span className="ml-2 text-base font-normal text-muted-foreground">
              of {formatINR(pace.target)}
            </span>
          </p>
          {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
        </div>
        <div className="text-right">
          <p
            className={`font-heading text-2xl font-bold ${
              pace.behind ? "erp-breathe text-saffron-deep" : "text-green-700 dark:text-green-400"
            }`}
          >
            {Math.round(pace.percent * 100)}%
          </p>
          <p className="text-xs text-muted-foreground">
            {pace.daysLeft} {pace.daysLeft === 1 ? "day" : "days"} left in {pace.label}
          </p>
        </div>
      </div>

      <div className="relative mt-3 h-3 overflow-hidden rounded-full bg-muted">
        <div
          className={`h-full origin-left rounded-full transition-all ${
            pace.behind
              ? "erp-bar-behind bg-saffron"
              : "bg-green-600 motion-safe:animate-[erp-grow_900ms_ease-out]"
          }`}
          style={{ width: `${pct * 100}%` }}
        />
        {/* Where the calendar says you should be by now */}
        <span
          className="absolute inset-y-0 w-0.5 bg-foreground/60"
          style={{ left: `${Math.min(100, pace.elapsed * 100)}%` }}
          aria-hidden
        />
      </div>

      <p className="mt-2 text-xs text-muted-foreground">
        {pace.target === 0
          ? "No target set for this period yet."
          : short > 0
            ? `${formatINR(short)} to go. The mark on the bar is where the calendar says you should be.`
            : "Target met."}
      </p>
    </div>
  );
}
