import { formatINR } from "@/lib/money";
import type { Pace } from "@/lib/sales-summary";

/**
 * Target, achieved, and how long is left.
 *
 * The bar carries a marker showing where the calendar says you should be, so
 * "60% done" means something. It pulses only when behind pace, because a
 * banner that flashes every day is a banner nobody looks at.
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

  return (
    <div
      className={`rounded-2xl border p-4 sm:p-5 ${
        pace.behind ? "border-saffron bg-saffron/10" : "border-border bg-card"
      }`}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">{title}</p>
          <p className="font-heading text-2xl font-bold sm:text-3xl">
            {formatINR(pace.achieved)}
            <span className="ml-2 text-base font-normal text-muted-foreground">
              of {formatINR(pace.target)}
            </span>
          </p>
          {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
        </div>
        <div className="text-right">
          <p
            className={`font-heading text-2xl font-bold ${
              pace.behind ? "animate-pulse text-saffron-deep" : "text-green-700 dark:text-green-400"
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
          className={`h-full rounded-full transition-all ${
            pace.behind ? "bg-saffron" : "bg-green-600"
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
