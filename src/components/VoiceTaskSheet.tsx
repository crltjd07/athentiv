"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Mic, MicOff, Wand2 } from "lucide-react";
import { parseTaskText, type ParsedTask } from "@/shared/taskParser";
import { effortOf, taskTypeLabel } from "@/shared/catalog";
import { fmtDue } from "@/lib/format";
import { Sheet } from "./Sheet";
import { Button, Input, cx } from "./ui";

type SpeechRec = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((e: { resultIndex: number; results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
};

function getRecognizer(): (new () => SpeechRec) | null {
  const w = window as unknown as { SpeechRecognition?: new () => SpeechRec; webkitSpeechRecognition?: new () => SpeechRec };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

/**
 * Speak (or type) a task in plain language. Parsed fields are shown for review and only fill
 * the form — nothing is saved until the user taps Save on the form itself.
 */
export function VoiceTaskSheet({ open, onClose, subjects, onApply }: { open: boolean; onClose: () => void; subjects: { id: number; name: string }[]; onApply: (p: ParsedTask) => void }) {
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [error, setError] = useState<string | null>(null);
  const rec = useRef<SpeechRec | null>(null);

  useEffect(() => setSupported(!!getRecognizer()), []);
  useEffect(() => {
    if (!open) {
      rec.current?.abort();
      setListening(false);
      setTranscript("");
      setError(null);
    }
  }, [open]);

  function start() {
    const R = getRecognizer();
    if (!R) return;
    setError(null);
    setTranscript("");
    const r = new R();
    r.lang = "en-PH";
    r.interimResults = true;
    r.continuous = false;
    r.onresult = (e) => {
      let text = "";
      for (let i = 0; i < e.results.length; i++) text += e.results[i][0].transcript;
      setTranscript(text);
    };
    r.onerror = (e) => {
      setError(e.error === "not-allowed" ? "Microphone access was blocked. Allow it in your browser settings, or type instead." : e.error === "no-speech" ? "Didn't catch that. Try again." : "Voice input stopped. You can type instead.");
      setListening(false);
    };
    r.onend = () => setListening(false);
    rec.current = r;
    r.start();
    setListening(true);
  }

  const parsed = transcript.trim() ? parseTaskText(transcript, subjects) : null;

  return (
    <Sheet open={open} onClose={onClose} title="Add by voice">
      <div className="flex flex-col items-center pt-2 text-center">
        {supported ? (
          <>
            <button
              type="button"
              onClick={() => (listening ? rec.current?.stop() : start())}
              aria-label={listening ? "Stop listening" : "Start listening"}
              className="relative grid size-28 place-items-center"
            >
              <span className={cx("absolute inset-0 rounded-full bg-brand-100", listening && "animate-ping")} />
              <span className="absolute inset-3 rounded-full bg-brand-50" />
              <span className={cx("relative grid size-16 place-items-center rounded-full text-white shadow-lg", listening ? "bg-red-500" : "bg-brand-700")}>
                {listening ? <MicOff className="size-7" /> : <Mic className="size-7" />}
              </span>
            </button>
            <p className="mt-3 font-bold text-ink">{listening ? "Listening…" : "Tap the microphone"}</p>
            <p className="mt-1 max-w-xs text-sm text-muted">Speak the details of your assignment, e.g. &ldquo;Programming project due next Friday, heavy effort&rdquo;.</p>
          </>
        ) : (
          <p className="max-w-xs text-sm text-muted">Voice input isn&apos;t available in this browser. Type the task in plain words and we&apos;ll fill in the form for you.</p>
        )}
      </div>

      <div className="mt-5">
        <Input
          placeholder="Or type it, e.g. Math quiz tomorrow 2pm"
          value={transcript}
          onChange={(e) => setTranscript(e.target.value)}
          leading={<Wand2 className="size-4 text-brand-500" />}
        />
        {error && <p className="mt-2 text-xs font-medium text-red-600">{error}</p>}
      </div>

      {parsed && (
        <div className="mt-4 rounded-2xl border border-line bg-slate-50 p-3.5 text-sm animate-fade-up">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-faint">Here&apos;s what we understood</p>
          <dl className="grid grid-cols-[84px_1fr] gap-y-1.5">
            <Row k="Title" v={parsed.title || "Not detected"} miss={!parsed.title} />
            <Row k="Type" v={parsed.type ? taskTypeLabel(parsed.type) : "Not detected"} miss={!parsed.type} />
            <Row k="Subject" v={parsed.subjectName ?? "Not detected"} miss={!parsed.subjectName} />
            <Row k="Due" v={parsed.due ? fmtDue(parsed.due.getTime()) : "Not detected"} miss={!parsed.due} />
            <Row k="Effort" v={parsed.effort ? effortOf(parsed.effort).label : "Not detected"} miss={!parsed.effort} />
          </dl>
          <p className="mt-2 text-xs text-muted">You can adjust anything on the next screen before saving.</p>
        </div>
      )}

      <div className="mt-5 space-y-2">
        <Button full disabled={!parsed || !parsed.title} icon={<Check className="size-4" />} onClick={() => parsed && onApply(parsed)}>
          Use these details
        </Button>
        <Button full variant="ghost" onClick={onClose}>
          Cancel
        </Button>
      </div>
    </Sheet>
  );
}

function Row({ k, v, miss }: { k: string; v: string; miss?: boolean }) {
  return (
    <>
      <dt className="text-muted">{k}</dt>
      <dd className={cx("font-semibold", miss ? "text-faint" : "text-ink")}>{v}</dd>
    </>
  );
}
