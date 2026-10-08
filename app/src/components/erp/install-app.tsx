"use client";

import * as React from "react";
import { Share, Smartphone } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * Puts the back office on the phone's home screen, so it opens like an app.
 *
 * Android and desktop Chrome hand us an install prompt to show when asked.
 * An iPhone never does: Safari only adds to the home screen from its own
 * Share menu, so there the button shows the two taps instead. Once it is on
 * the home screen, and opened from there, the button goes away.
 */

type InstallEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

let deferred: InstallEvent | null = null;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => {
    // Kept for the button rather than shown as Chrome's own bar
    e.preventDefault();
    deferred = e as InstallEvent;
    notify();
  });
  window.addEventListener("appinstalled", () => {
    deferred = null;
    notify();
  });
}

type Mode = "hidden" | "prompt" | "ios";

function mode(): Mode {
  const standalone =
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true;
  if (standalone) return "hidden";
  if (deferred) return "prompt";
  const ios =
    /iPhone|iPad|iPod/.test(navigator.userAgent) ||
    (/Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1);
  return ios ? "ios" : "hidden";
}

const subscribe = (cb: () => void) => {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
};

export function InstallApp({ variant }: { variant: "menu" | "card" }) {
  const state = React.useSyncExternalStore(subscribe, mode, () => "hidden" as Mode);
  const [help, setHelp] = React.useState(false);
  if (state === "hidden") return null;

  async function tap() {
    if (state === "ios" || !deferred) {
      setHelp((h) => !h);
      return;
    }
    await deferred.prompt();
    await deferred.userChoice;
    deferred = null;
    notify();
  }

  const steps = (
    <p
      className={cn(
        "text-xs leading-relaxed",
        variant === "menu" ? "px-3 pt-1.5 text-white/70" : "pt-2 text-muted-foreground",
      )}
    >
      In <b>Safari</b>, tap the Share button <Share className="inline size-3.5 -translate-y-px" />, then{" "}
      <b>Add to Home Screen</b>. It then opens like an app.
    </p>
  );

  if (variant === "menu") {
    return (
      <div>
        <button
          type="button"
          onClick={() => void tap()}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-1.5 text-sm font-medium text-white/75 transition hover:bg-white/7 hover:text-white"
        >
          <Smartphone className="size-4 shrink-0 text-saffron" />
          Add to home screen
        </button>
        {help && steps}
      </div>
    );
  }

  return (
    <div className="rounded-xl border bg-card/80 p-3 text-center">
      <button
        type="button"
        onClick={() => void tap()}
        className="inline-flex items-center gap-2 text-sm font-medium text-foreground hover:underline"
      >
        <Smartphone className="size-4" /> Add the back office to your home screen
      </button>
      {help && steps}
    </div>
  );
}
