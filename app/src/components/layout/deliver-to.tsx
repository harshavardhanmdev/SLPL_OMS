"use client";

import * as React from "react";
import { MapPin } from "lucide-react";

const PIN_KEY = "slpl-pincode"; // shared with the PDP delivery-estimate widget

/** Amazon-style "Deliver to <pincode>" chip with an inline pincode editor. */
export function DeliverTo() {
  const [pincode, setPincode] = React.useState<string | null>(null);
  const [open, setOpen] = React.useState(false);
  const [draft, setDraft] = React.useState("");
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    setPincode(window.localStorage.getItem(PIN_KEY));
  }, []);

  React.useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  function save() {
    if (!/^[1-9][0-9]{5}$/.test(draft)) return;
    window.localStorage.setItem(PIN_KEY, draft);
    setPincode(draft);
    setOpen(false);
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => {
          setDraft(pincode ?? "");
          setOpen((o) => !o);
        }}
        className="flex items-center gap-1.5 rounded-md px-2 py-1.5 text-left leading-tight ring-white/60 transition hover:ring-1"
      >
        <MapPin className="size-4 shrink-0 text-saffron" />
        <span>
          <span className="block text-[11px] text-white/70">Deliver to</span>
          <span className="block text-sm font-semibold text-white">
            {pincode ?? "Select pincode"}
          </span>
        </span>
      </button>

      {open && (
        <div className="absolute left-0 top-full z-50 mt-2 w-56 rounded-lg border bg-popover p-3 text-popover-foreground shadow-lg">
          <p className="mb-2 text-xs font-medium">Where should we deliver?</p>
          <div className="flex gap-2">
            <input
              autoFocus
              inputMode="numeric"
              maxLength={6}
              value={draft}
              onChange={(e) => setDraft(e.target.value.replace(/\D/g, ""))}
              onKeyDown={(e) => e.key === "Enter" && save()}
              placeholder="Pincode"
              className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm outline-none focus:border-ring"
            />
            <button
              type="button"
              onClick={save}
              disabled={draft.length !== 6}
              className="h-9 rounded-md bg-saffron px-3 text-sm font-semibold text-navy disabled:opacity-50"
            >
              Set
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
