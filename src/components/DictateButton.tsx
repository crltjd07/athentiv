"use client";

import { useEffect, useRef, useState } from "react";
import { Mic, MicOff } from "lucide-react";
import { useToast } from "./Toast";
import { cx } from "./ui";

type Recognizer = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((e: { results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
};

export function getRecognizer(): (new () => Recognizer) | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: new () => Recognizer; webkitSpeechRecognition?: new () => Recognizer };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

/** Small mic button that types what you say into a field. Hidden where speech input isn't available. */
export function DictateButton({ onText, label = "Speak", className }: { onText: (text: string) => void; label?: string; className?: string }) {
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const rec = useRef<Recognizer | null>(null);
  const toast = useToast();

  useEffect(() => {
    setSupported(!!getRecognizer());
    return () => rec.current?.abort();
  }, []);

  if (!supported) return null;

  function toggle() {
    if (listening) {
      rec.current?.stop();
      return;
    }
    const R = getRecognizer();
    if (!R) return;
    const r = new R();
    r.lang = "en-PH";
    r.interimResults = false;
    r.continuous = false;
    r.onresult = (e) => {
      let text = "";
      for (let i = 0; i < e.results.length; i++) if (e.results[i].isFinal) text += e.results[i][0].transcript;
      text = text.trim();
      if (text) onText(text.charAt(0).toUpperCase() + text.slice(1));
    };
    r.onerror = (e) => {
      if (e.error === "not-allowed") toast("Microphone access is blocked. Allow it in your browser settings.", "error");
      else if (e.error !== "no-speech" && e.error !== "aborted") toast("Voice input stopped. Please try again.", "error");
      setListening(false);
    };
    r.onend = () => setListening(false);
    rec.current = r;
    r.start();
    setListening(true);
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={listening ? "Stop listening" : label}
      title={listening ? "Stop listening" : label}
      className={cx(
        "grid size-9 shrink-0 place-items-center rounded-full transition-colors",
        listening ? "bg-red-500 text-white animate-pulse" : "bg-brand-50 text-brand-700",
        className,
      )}
    >
      {listening ? <MicOff className="size-4" /> : <Mic className="size-4" />}
    </button>
  );
}
