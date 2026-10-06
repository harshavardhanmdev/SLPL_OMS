import { Skeleton } from "@/components/ui/skeleton";

/**
 * Shown the instant a screen is tapped, while the server fetches it. Every
 * back office page reads the database on each visit, so without this a slow
 * phone connection looks like a tap that did nothing.
 */
export default function ErpLoading() {
  return (
    <div className="space-y-5" aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading</span>
      <div className="fixed inset-x-0 top-0 z-50 h-0.5 overflow-hidden bg-saffron/20 lg:left-60">
        <div className="h-full w-1/3 animate-[erp-progress_1.1s_ease-in-out_infinite] bg-saffron" />
      </div>
      <div className="space-y-2">
        <Skeleton className="h-7 w-48" />
        <Skeleton className="h-4 w-72 max-w-full" />
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-24 rounded-2xl" />
        ))}
      </div>
      <div className="space-y-3 rounded-2xl border bg-card p-4">
        {Array.from({ length: 5 }, (_, i) => (
          <div key={i} className="flex items-center gap-3">
            <Skeleton className="size-10 shrink-0 rounded-xl" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-3 w-1/3" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
