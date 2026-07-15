"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Mic, Search } from "lucide-react";
import { toast } from "sonner";

import { cn } from "@/lib/utils";

type SpeechRecognitionLike = {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  start: () => void;
  stop: () => void;
  onresult: ((e: { results: { [i: number]: { [j: number]: { transcript: string } } } }) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
};

declare global {
  interface Window {
    webkitSpeechRecognition?: new () => SpeechRecognitionLike;
    SpeechRecognition?: new () => SpeechRecognitionLike;
  }
}

/** Search box with voice input (header + search page). */
export function SearchBar({
  defaultValue = "",
  variant = "header",
  className,
}: {
  defaultValue?: string;
  variant?: "header" | "page";
  className?: string;
}) {
  const router = useRouter();
  const [value, setValue] = React.useState(defaultValue);
  const [listening, setListening] = React.useState(false);
  const [micSupported, setMicSupported] = React.useState(false);
  const recRef = React.useRef<SpeechRecognitionLike | null>(null);

  React.useEffect(() => {
    setMicSupported(Boolean(window.SpeechRecognition ?? window.webkitSpeechRecognition));
  }, []);

  function startMic() {
    const Ctor = window.SpeechRecognition ?? window.webkitSpeechRecognition;
    if (!Ctor) return;
    const rec = new Ctor();
    recRef.current = rec;
    rec.lang = "en-IN";
    rec.interimResults = false;
    rec.maxAlternatives = 1;
    rec.onresult = (e) => {
      const transcript = e.results[0]?.[0]?.transcript ?? "";
      if (transcript) {
        setValue(transcript);
        router.push(`/search?q=${encodeURIComponent(transcript)}`);
      }
    };
    rec.onerror = () => {
      setListening(false);
      toast.error("Could not hear you. Check the microphone permission.");
    };
    rec.onend = () => setListening(false);
    setListening(true);
    rec.start();
  }

  return (
    <form
      role="search"
      className={className}
      onSubmit={(e) => {
        e.preventDefault();
        router.push(`/search?q=${encodeURIComponent(value)}`);
      }}
    >
      <div
        className={cn(
          "flex overflow-hidden",
          variant === "header"
            ? "h-10 rounded-md bg-white ring-saffron focus-within:ring-2"
            : "h-12 rounded-full border border-input bg-muted/60 focus-within:border-ring focus-within:bg-background",
        )}
      >
        <input
          type="search"
          name="q"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={listening ? "Listening…" : "Search books, series, grades…"}
          autoFocus={variant === "page"}
          className={cn(
            "w-full bg-transparent outline-none",
            variant === "header"
              ? "px-3 text-sm text-neutral-900 placeholder:text-neutral-500"
              : "px-5 text-base",
          )}
        />
        {micSupported && (
          <button
            type="button"
            aria-label="Search by voice"
            onClick={() => (listening ? recRef.current?.stop() : startMic())}
            className={cn(
              "grid w-10 shrink-0 place-items-center transition-colors",
              variant === "header" ? "text-neutral-500 hover:text-neutral-800" : "text-muted-foreground hover:text-foreground",
              listening && "animate-pulse text-red-600",
            )}
          >
            <Mic className="size-4.5" />
          </button>
        )}
        <button
          type="submit"
          aria-label="Search"
          className={cn(
            "grid shrink-0 place-items-center transition-colors",
            variant === "header"
              ? "w-11 bg-saffron hover:bg-saffron-deep"
              : "w-12 text-muted-foreground hover:text-foreground",
          )}
        >
          <Search className={variant === "header" ? "size-5 text-navy" : "size-5"} />
        </button>
      </div>
    </form>
  );
}
