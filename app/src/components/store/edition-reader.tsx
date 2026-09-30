"use client";

import * as React from "react";
import { ChevronLeft, ChevronRight, Loader2, ZoomIn, ZoomOut } from "lucide-react";

import { Button } from "@/components/ui/button";

/**
 * The reader.
 *
 * Pages are fetched as blobs and painted into a canvas, and the bitmap is
 * closed straight away, so there is no image element to right click, drag to
 * the desktop or "save image as". None of that is security, and the copy we
 * show the reader says as much: the real deterrent is the watermark carrying
 * their name on every page. This only removes the accidental one-click copy.
 */
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
  const [failure, setFailure] = React.useState<{ page: number; message: string } | null>(null);
  const canvasRef = React.useRef<HTMLCanvasElement>(null);

  // Derived rather than stored, so nothing has to be set while the effect runs
  const error = failure?.page === page ? failure.message : null;
  const loading = shown !== page && !error;

  React.useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    void (async () => {
      try {
        const res = await fetch(`/api/read/${slug}/${page}`, {
          signal: controller.signal,
          cache: "no-store",
        });
        if (!res.ok) {
          throw new Error(
            res.status === 429
              ? "Turning pages a little fast. Wait a moment and try again."
              : res.status === 403 || res.status === 401
                ? "Sign in with the account that bought this issue."
                : "That page could not be loaded.",
          );
        }
        const bitmap = await createImageBitmap(await res.blob());
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
      } catch (err) {
        if (cancelled || (err as Error).name === "AbortError") return;
        setFailure({ page, message: (err as Error).message });
      }
    })();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [slug, page]);

  const go = React.useCallback(
    (next: number) => setPage((p) => Math.min(pageCount, Math.max(1, next || p))),
    [pageCount],
  );

  React.useEffect(() => {
    function onKey(e: KeyboardEvent) {
      // Speed bumps, not locks. A determined reader has a Print Screen key.
      if ((e.ctrlKey || e.metaKey) && ["s", "p"].includes(e.key.toLowerCase())) {
        e.preventDefault();
        return;
      }
      if (e.key === "ArrowRight" || e.key === "PageDown") go(page + 1);
      if (e.key === "ArrowLeft" || e.key === "PageUp") go(page - 1);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go, page]);

  return (
    <div className="flex min-h-screen flex-col bg-navy" onContextMenu={(e) => e.preventDefault()}>
      <style>{"@media print { body { display: none !important } }"}</style>

      <header className="sticky top-0 z-20 flex flex-wrap items-center gap-2 border-b border-white/10 bg-navy px-3 py-2 text-white">
        <p className="mr-auto line-clamp-1 font-heading text-sm font-semibold">{title}</p>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="text-white hover:bg-white/10 hover:text-white"
            onClick={() => setZoom((z) => Math.max(0.6, z - 0.2))}
            aria-label="Zoom out"
          >
            <ZoomOut className="size-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="text-white hover:bg-white/10 hover:text-white"
            onClick={() => setZoom((z) => Math.min(2.4, z + 0.2))}
            aria-label="Zoom in"
          >
            <ZoomIn className="size-4" />
          </Button>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="text-white hover:bg-white/10 hover:text-white"
            disabled={page <= 1}
            onClick={() => go(page - 1)}
            aria-label="Previous page"
          >
            <ChevronLeft className="size-5" />
          </Button>
          <span className="min-w-20 text-center text-sm tabular-nums">
            {page} of {pageCount}
          </span>
          <Button
            variant="ghost"
            size="icon"
            className="text-white hover:bg-white/10 hover:text-white"
            disabled={page >= pageCount}
            onClick={() => go(page + 1)}
            aria-label="Next page"
          >
            <ChevronRight className="size-5" />
          </Button>
        </div>
      </header>

      <div className="flex flex-1 justify-center overflow-auto p-3 sm:p-6">
        <div className="relative" style={{ width: `${Math.round(zoom * 100)}%`, maxWidth: 1100 }}>
          {loading && (
            <div className="absolute inset-0 flex items-center justify-center">
              <Loader2 className="size-8 animate-spin text-white/70" />
            </div>
          )}
          {error ? (
            <p className="rounded-xl bg-white/10 p-8 text-center text-sm text-white">{error}</p>
          ) : (
            <canvas
              ref={canvasRef}
              onDragStart={(e) => e.preventDefault()}
              className="w-full select-none rounded-lg shadow-2xl"
              style={{ opacity: loading ? 0.25 : 1, transition: "opacity 150ms" }}
            />
          )}
        </div>
      </div>

      <footer className="border-t border-white/10 px-4 py-2 text-center text-xs text-white/60">
        Your personal copy. Every page carries your name and licence number, so please do not pass
        pages on.
      </footer>
    </div>
  );
}
