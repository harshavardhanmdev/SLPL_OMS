"use client";

import * as React from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Maximize2,
  Minimize2,
  ZoomIn,
  ZoomOut,
} from "lucide-react";

import { Button } from "@/components/ui/button";

/**
 * The reader.
 *
 * Pages are fetched as blobs and painted into a canvas, and the bitmap is
 * closed once it is drawn, so there is no image element to right click, drag
 * to the desktop or "save image as". None of that is security, and the copy we
 * show the reader says as much: the real deterrent is the watermark carrying
 * their name on every page. This only removes the accidental one-click copy.
 *
 * A whole page fits the screen by default, because a magazine spread that
 * needs scrolling to see is not a magazine. Zoom is opt in from there.
 */

/** How far a thumb has to travel before it counts as turning a page. */
const SWIPE_PX = 50;

export function EditionReader({
  slug,
  pageCount,
  title,
}: {
  slug: string;
  pageCount: number;
  title: string;
}) {
  const [page, setPage] = React.useState(1);
  const [zoom, setZoom] = React.useState(1);
  /** The page currently painted on the canvas. */
  const [shown, setShown] = React.useState(0);
  /** Which way the last turn went, so the new page slides in from that side. */
  const [direction, setDirection] = React.useState<1 | -1>(1);
  const [failure, setFailure] = React.useState<{ page: number; message: string } | null>(null);
  /** Bumped by Try again, so the effect runs even though the page has not changed. */
  const [attempt, setAttempt] = React.useState(0);
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  /** The next page, fetched early so a turn does not wait on the network. */
  const ahead = React.useRef<{ page: number; blob: Blob } | null>(null);
  const touch = React.useRef<{ x: number; y: number } | null>(null);

  // Derived rather than stored, so nothing has to be set while the effect runs
  const error = failure?.page === page ? failure.message : null;
  const loading = shown !== page && !error;

  const go = React.useCallback(
    (next: number) => {
      const target = Math.min(pageCount, Math.max(1, next));
      setDirection(target >= page ? 1 : -1);
      setPage(target);
    },
    [page, pageCount],
  );

  React.useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    async function load(n: number, signal: AbortSignal): Promise<Blob> {
      const res = await fetch(`/api/read/${slug}/${n}`, { signal, cache: "no-store" });
      if (!res.ok) {
        throw new Error(
          res.status === 429
            ? "Turning pages a little fast. Wait a moment and try again."
            : res.status === 401
              ? "Your session has expired. Sign in again to carry on reading."
              : res.status === 403
                ? "This copy belongs to a different account. Sign in with the one that bought it."
                : res.status === 404
                  ? `Page ${n} is missing from this issue. Please tell us and we will put it right.`
                  : res.status === 503
                    ? "Reading is briefly unavailable while we fix something at our end. Please try again shortly."
                    : "Something went wrong loading that page. Try again in a moment.",
        );
      }
      return res.blob();
    }

    void (async () => {
      try {
        const cached = ahead.current?.page === page ? ahead.current.blob : null;
        const blob = cached ?? (await load(page, controller.signal));
        const bitmap = await createImageBitmap(blob);
        if (cancelled) {
          bitmap.close();
          return;
        }
        const canvas = canvasRef.current;
        if (canvas) {
          canvas.width = bitmap.width;
          canvas.height = bitmap.height;
          canvas.getContext("2d")?.drawImage(bitmap, 0, 0);
        }
        bitmap.close();
        setShown(page);

        // Fetch the next page while they read this one
        const next = page + 1;
        if (next <= pageCount && ahead.current?.page !== next) {
          ahead.current = null;
          load(next, controller.signal)
            .then((b) => {
              if (!cancelled) ahead.current = { page: next, blob: b };
            })
            .catch(() => {
              // a failed prefetch just means the next turn waits
            });
        }
      } catch (err) {
        if (cancelled || (err as Error).name === "AbortError") return;
        setFailure({ page, message: (err as Error).message });
      }
    })();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [slug, page, pageCount, attempt]);

  React.useEffect(() => {
    function onKey(e: KeyboardEvent) {
      // Speed bumps, not locks. A determined reader has a Print Screen key.
      if ((e.ctrlKey || e.metaKey) && ["s", "p"].includes(e.key.toLowerCase())) {
        e.preventDefault();
        return;
      }
      if (e.key === "ArrowRight" || e.key === "PageDown" || e.key === " ") go(page + 1);
      if (e.key === "ArrowLeft" || e.key === "PageUp") go(page - 1);
      if (e.key === "Home") go(1);
      if (e.key === "End") go(pageCount);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go, page, pageCount]);

  // Swiping only turns pages at fit-to-screen. Zoomed in, a drag is a pan.
  function onTouchStart(e: React.TouchEvent) {
    if (zoom > 1) return;
    const t = e.touches[0];
    touch.current = { x: t.clientX, y: t.clientY };
  }
  function onTouchEnd(e: React.TouchEvent) {
    const start = touch.current;
    touch.current = null;
    if (!start) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - start.x;
    const dy = t.clientY - start.y;
    if (Math.abs(dx) < SWIPE_PX || Math.abs(dx) < Math.abs(dy)) return;
    go(dx < 0 ? page + 1 : page - 1);
  }

  const slide = loading
    ? direction === 1
      ? "translate-x-6 opacity-0"
      : "-translate-x-6 opacity-0"
    : "translate-x-0 opacity-100";

  const arrow =
    "pointer-events-auto grid size-11 place-items-center rounded-full bg-black/35 text-white backdrop-blur transition hover:bg-black/55 disabled:pointer-events-none disabled:opacity-0";

  return (
    <div
      className="fixed inset-0 flex flex-col overflow-hidden bg-navy"
      onContextMenu={(e) => e.preventDefault()}
    >
      <style>{"@media print { body { display: none !important } }"}</style>

      <header className="flex shrink-0 items-center gap-2 border-b border-white/10 px-2 py-1.5 text-white sm:px-3">
        <Link
          href="/account/library"
          className="grid size-9 shrink-0 place-items-center rounded-md transition hover:bg-white/10"
          aria-label="Back to my library"
        >
          <ArrowLeft className="size-5" />
        </Link>
        <p className="mr-auto line-clamp-1 text-sm font-medium sm:text-base">{title}</p>
        <Button
          variant="ghost"
          size="icon"
          className="hidden text-white hover:bg-white/10 hover:text-white sm:inline-flex"
          onClick={() => setZoom((z) => Math.max(1, Number((z - 0.25).toFixed(2))))}
          disabled={zoom <= 1}
          aria-label="Zoom out"
        >
          <ZoomOut className="size-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="text-white hover:bg-white/10 hover:text-white"
          onClick={() => setZoom((z) => (z > 1 ? 1 : 2))}
          aria-label={zoom > 1 ? "Fit the page to the screen" : "Zoom in"}
        >
          {zoom > 1 ? <Minimize2 className="size-4" /> : <Maximize2 className="size-4" />}
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="hidden text-white hover:bg-white/10 hover:text-white sm:inline-flex"
          onClick={() => setZoom((z) => Math.min(3, Number((z + 0.25).toFixed(2))))}
          disabled={zoom >= 3}
          aria-label="Zoom in"
        >
          <ZoomIn className="size-4" />
        </Button>
      </header>

      {/* The overlay sits outside the scroller, so the arrows stay put when zoomed */}
      <div className="relative min-h-0 flex-1">
        <main
          className="h-full overflow-auto overscroll-contain"
          onTouchStart={onTouchStart}
          onTouchEnd={onTouchEnd}
        >
          {/* At fit, the wrapper has a definite height so the canvas can be
              capped against it. Zoomed, it grows and the scroller takes over. */}
          <div
            className={
              zoom > 1
                ? "flex min-h-full min-w-full p-2"
                : "flex h-full w-full items-center justify-center p-2"
            }
          >
            {error ? (
              <div className="m-auto max-w-sm rounded-2xl bg-white/10 p-8 text-center">
                <p className="text-sm text-white">{error}</p>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-4 border-white/30 bg-transparent text-white hover:bg-white/10 hover:text-white"
                  onClick={() => {
                    setFailure(null);
                    setAttempt((n) => n + 1);
                  }}
                >
                  Try again
                </Button>
              </div>
            ) : (
              <canvas
                ref={canvasRef}
                onDragStart={(e) => e.preventDefault()}
                className={`m-auto block select-none rounded shadow-2xl transition-[transform,opacity] duration-300 ease-out ${slide} ${
                  zoom > 1 ? "" : "max-h-full max-w-full"
                }`}
                style={zoom > 1 ? { width: `${zoom * 100}%`, height: "auto" } : undefined}
              />
            )}
          </div>
        </main>

        {loading && (
          <div className="pointer-events-none absolute inset-0 grid place-items-center">
            <Loader2 className="size-8 animate-spin text-white/60" />
          </div>
        )}

        {/* Big targets that sit beside the page, within reach on any screen */}
        <div className="pointer-events-none absolute inset-y-0 left-0 right-0 hidden items-center justify-between px-2 sm:flex sm:px-4">
          <button
            type="button"
            className={arrow}
            disabled={page <= 1}
            onClick={() => go(page - 1)}
            aria-label="Previous page"
          >
            <ChevronLeft className="size-6" />
          </button>
          <button
            type="button"
            className={arrow}
            disabled={page >= pageCount}
            onClick={() => go(page + 1)}
            aria-label="Next page"
          >
            <ChevronRight className="size-6" />
          </button>
        </div>
      </div>

      <footer className="shrink-0 border-t border-white/10 bg-navy text-white">
        <div className="flex items-center justify-center gap-3 px-3 py-2">
          <button
            type="button"
            className="grid size-11 place-items-center rounded-full bg-white/10 transition hover:bg-white/20 disabled:opacity-30"
            disabled={page <= 1}
            onClick={() => go(page - 1)}
            aria-label="Previous page"
          >
            <ChevronLeft className="size-5" />
          </button>

          <label className="flex items-center gap-2 text-sm">
            <span className="sr-only">Go to page</span>
            <input
              type="range"
              min={1}
              max={pageCount}
              value={page}
              onChange={(e) => go(Number(e.target.value))}
              className="h-1.5 w-40 cursor-pointer appearance-none rounded-full bg-white/25 accent-saffron sm:w-72"
              aria-label={`Page ${page} of ${pageCount}`}
            />
            <span className="w-16 shrink-0 text-center tabular-nums">
              {page} / {pageCount}
            </span>
          </label>

          <button
            type="button"
            className="grid size-11 place-items-center rounded-full bg-white/10 transition hover:bg-white/20 disabled:opacity-30"
            disabled={page >= pageCount}
            onClick={() => go(page + 1)}
            aria-label="Next page"
          >
            <ChevronRight className="size-5" />
          </button>
        </div>
        <p className="px-4 pb-2 text-center text-[11px] leading-tight text-white/50">
          Your personal copy. Every page carries your name and licence number, so please do not pass
          pages on.
        </p>
      </footer>
    </div>
  );
}
