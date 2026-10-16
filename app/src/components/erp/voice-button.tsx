"use client";

import * as React from "react";
import { Mic } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

type Recognition = {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  start: () => void;
  stop: () => void;
  onresult: ((e: { results: { [i: number]: { [j: number]: { transcript: string } } } }) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
};

/** The store's search box declares these on Window too, so read them through a local type. */
const speech = () =>
  window as unknown as {
    SpeechRecognition?: new () => Recognition;
    webkitSpeechRecognition?: new () => Recognition;
  };

/**
 * Speak instead of typing, through the phone's own speech recognition (Indian
 * English), as the store's search does. Hidden where the browser has none.
 */
export function VoiceButton({ onText, label = "Speak" }: { onText: (text: string) => void; label?: string }) {
  const [supported, setSupported] = React.useState(false);
  const [listening, setListening] = React.useState(false);
  const rec = React.useRef<Recognition | null>(null);

  React.useEffect(() => {
    setSupported(Boolean(speech().SpeechRecognition ?? speech().webkitSpeechRecognition));
  }, []);

  if (!supported) return null;

  function start() {
    const Ctor = speech().SpeechRecognition ?? speech().webkitSpeechRecognition;
    if (!Ctor) return;
    const r = new Ctor();
    r.lang = "en-IN";
    r.interimResults = false;
    r.maxAlternatives = 1;
    r.onresult = (e) => {
      const said = e.results[0]?.[0]?.transcript?.trim();
      if (said) onText(said);
    };
    r.onerror = () => toast.error("Could not hear that. Try again, or type it.");
    r.onend = () => setListening(false);
    rec.current = r;
    setListening(true);
    r.start();
  }

  return (
    <Button
      type="button"
      variant={listening ? "default" : "outline"}
      size="icon"
      className={`size-11 shrink-0 ${listening ? "animate-pulse" : ""}`}
      aria-label={listening ? "Stop listening" : label}
      onClick={() => (listening ? rec.current?.stop() : start())}
    >
      <Mic className="size-5" />
    </Button>
  );
}
