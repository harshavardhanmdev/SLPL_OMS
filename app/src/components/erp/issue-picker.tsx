import Link from "next/link";

import { cn } from "@/lib/utils";

/**
 * The GenZ Times issue a screen works on, as buttons rather than a box to type
 * in, so nobody records "November2026" by accident. Each is a link, so the
 * choice lives in the address and survives a refresh.
 */
export function IssuePicker({
  issue,
  choices,
  href,
  question,
  hint,
}: {
  issue: string;
  choices: string[];
  /** The screen, which gets ?issue= added */
  href: string;
  question: string;
  hint?: string;
}) {
  return (
    <div className="rounded-2xl border bg-card p-4">
      <p className="text-sm font-medium">{question}</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {choices.map((c) => (
          <Link
            key={c}
            href={`${href}?issue=${encodeURIComponent(c)}`}
            aria-current={c === issue ? "page" : undefined}
            className={cn(
              "rounded-full border px-4 py-1.5 text-sm font-medium transition-colors",
              c === issue ? "border-navy bg-navy text-white" : "bg-background hover:bg-muted",
            )}
          >
            {c}
          </Link>
        ))}
      </div>
      {hint && <p className="mt-2 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}
