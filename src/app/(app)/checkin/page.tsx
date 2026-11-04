"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { ArrowRight, Sparkles, X } from "lucide-react";
import { api } from "@/lib/api";
import { useMe } from "@/lib/me";
import { useWebNfc } from "@/lib/webnfc";
import { MINDSETS, MOODS, effortOf, moodOf, mindsetOf, type MindsetKey, type MoodKey } from "@/shared/catalog";
import { LockedCard, useApiErrorHandler } from "@/components/Premium";
import { AccessDenied, NfcRequired } from "@/components/SystemScreens";
import { useToast } from "@/components/Toast";
import { Button, ButtonLink, Chip, Textarea, cx } from "@/components/ui";

type Result = {
  checkin: { mood: MoodKey; mindset: MindsetKey; createdAt: number };
  response: { message: string; tip: string; readiness: string; suggestion: { label: string; text: string; effort: "S" | "M" | "L" } };
  previous: { mood: MoodKey; mindset: MindsetKey; createdAt: number } | null;
  historyLocked: boolean;
};

const INTENSITY = ["A little", "Somewhat", "Moderately", "Quite", "Very"];

function CheckIn() {
  const { me, refresh } = useMe();
  const router = useRouter();
  const params = useSearchParams();
  const verificationId = params.get("v") ? Number(params.get("v")) : null;
  const onError = useApiErrorHandler();
  const toast = useToast();
  const nfc = useWebNfc();
  const [mood, setMood] = useState<MoodKey | null>(null);
  const [mindset, setMindset] = useState<MindsetKey | null>(null);
  const [intensity, setIntensity] = useState<number | null>(null);
  const [note, setNote] = useState("");
  const [showNote, setShowNote] = useState(false);
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<Result | null>(null);

  if (!me.access.standOwner) return <AccessDenied />;
  if (!me.access.nfc.verified) {
    return (
      <main className="mx-auto max-w-[480px] px-4 pt-safe">
        <NfcRequired
          scanSupported={nfc.supported}
          scanning={nfc.scanning}
          onScan={async () => {
            try {
              await api("/api/nfc/verify", { body: await nfc.scan() });
              await refresh();
            } catch (e) {
              toast(e instanceof Error ? e.message : "Couldn't verify.", "error");
            }
          }}
        />
      </main>
    );
  }

  async function skip() {
    await api("/api/checkins/skip", { body: { verificationId } }).catch(() => {});
    router.replace("/focus");
  }

  async function save() {
    if (!mood || !mindset) return;
    setSaving(true);
    try {
      setResult(await api<Result>("/api/checkins", { body: { mood, mindset, intensity, note: note.trim() || null, verificationId } }));
    } catch (e) {
      onError(e);
    } finally {
      setSaving(false);
    }
  }

  if (result) {
    const m = moodOf(result.checkin.mood);
    const prev = result.previous ? moodOf(result.previous.mood) : null;
    return (
      <main className="mx-auto flex min-h-dvh max-w-[480px] flex-col px-5 pt-safe pb-safe">
        <div className="flex-1 pt-10 text-center animate-fade-up">
          <div className="mx-auto grid size-24 place-items-center rounded-[32px] text-6xl animate-pop" style={{ background: m.bg }}>
            {m.emoji}
          </div>
          <h1 className="mt-5 text-2xl font-extrabold tracking-tight text-ink">{result.response.message}</h1>
          <p className="mt-2 text-[15px] text-ink-2">{result.response.tip}</p>
          <div className="mt-6 rounded-[20px] border border-brand-100 bg-brand-50/70 p-4 text-left">
            <p className="flex items-center gap-1.5 text-sm font-bold text-brand-800">
              <Sparkles className="size-4" /> {result.response.suggestion.label}
            </p>
            <p className="mt-1 text-sm text-ink-2">{result.response.suggestion.text}</p>
            <p className="mt-2 text-xs text-muted">Suggested task size: {effortOf(result.response.suggestion.effort).label}</p>
          </div>
          {prev ? (
            <div className="mt-3 rounded-[20px] border border-line bg-white p-4 text-left text-sm">
              <p className="font-semibold text-ink">Compared with your last check-in</p>
              <p className="mt-1 text-ink-2">
                {prev.emoji} {prev.label} → {m.emoji} {m.label}
                <span className="text-muted"> · {mindsetOf(result.previous!.mindset).label.toLowerCase()} → {mindsetOf(result.checkin.mindset).label.toLowerCase()}</span>
              </p>
              <Link href="/mood" className="mt-2 inline-block text-xs font-semibold text-brand-700">View mood history →</Link>
            </div>
          ) : result.historyLocked ? (
            <LockedCard className="mt-3 text-left" title="Mood history & trends" body="See your check-in history, mood calendar and how your mood relates to your focus time." feature="Mood history" />
          ) : null}
          <p className="mt-4 text-[11px] text-faint">If you&apos;re having a hard time, talk to someone you trust or your school&apos;s guidance office.</p>
        </div>
        <div className="space-y-2 pt-6">
          <ButtonLink href="/focus" full size="lg" icon={<ArrowRight className="size-5" />}>
            Start focusing
          </ButtonLink>
          <ButtonLink href="/home" full variant="ghost">
            Go to Home
          </ButtonLink>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-[480px] flex-col px-5 pt-safe pb-safe">
      <div className="flex h-12 items-center justify-between">
        <span className="text-sm font-semibold text-brand-700">Quick check-in</span>
        <button onClick={skip} className="inline-flex items-center gap-1 text-sm font-semibold text-muted">
          Skip <X className="size-4" />
        </button>
      </div>
      <h1 className="mt-4 text-[26px] font-extrabold leading-tight tracking-tight text-ink">
        How are you feeling,
        <br />
        {me.profile.displayName}?
      </h1>

      <div className="mt-5 grid grid-cols-3 gap-2.5" role="radiogroup" aria-label="Mood">
        {MOODS.map((m) => (
          <button
            key={m.key}
            role="radio"
            aria-checked={mood === m.key}
            onClick={() => setMood(m.key)}
            className={cx("flex flex-col items-center gap-1 rounded-[20px] border-2 py-3.5 transition-transform active:scale-95", mood === m.key ? "scale-[1.03]" : "border-transparent")}
            style={{ background: m.bg, borderColor: mood === m.key ? m.color : "transparent" }}
          >
            <span className="text-4xl">{m.emoji}</span>
            <span className="text-sm font-semibold" style={{ color: m.color }}>{m.label}</span>
          </button>
        ))}
      </div>

      {mood && (
        <div className="mt-4 animate-fade-up">
          <p className="mb-2 px-1 text-sm font-semibold text-ink">How strongly? <span className="font-normal text-muted">(optional)</span></p>
          {/* Buttons grow from their label width (flex-auto, not flex-1), so every label gets the
              same side padding; longer labels such as "Moderately" are no longer squeezed.
              They wrap onto a second line only on screens narrower than about 340 px. */}
          <div className="flex flex-wrap gap-1.5">
            {INTENSITY.map((l, i) => (
              <button key={l} aria-pressed={intensity === i + 1} onClick={() => setIntensity(intensity === i + 1 ? null : i + 1)} className={cx("h-9 flex-auto whitespace-nowrap rounded-full border px-1.5 text-[11px] font-semibold", intensity === i + 1 ? "border-brand-700 bg-brand-700 text-white" : "border-line bg-white text-ink-2")}>
                {l}
              </button>
            ))}
          </div>
        </div>
      )}

      <h2 className="mt-6 px-1 text-[17px] font-bold text-ink">What&apos;s your study mindset?</h2>
      <div className="mt-3 flex flex-wrap gap-2">
        {MINDSETS.map((m) => (
          <Chip key={m.key} selected={mindset === m.key} onClick={() => setMindset(m.key)}>
            {m.label}
          </Chip>
        ))}
      </div>

      <div className="mt-5">
        {showNote ? (
          <Textarea placeholder="Anything on your mind? (only you can see this)" maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} />
        ) : (
          <button onClick={() => setShowNote(true)} className="px-1 text-sm font-semibold text-brand-700">
            + Add a note
          </button>
        )}
      </div>

      <div className="mt-auto pt-6">
        <Button full size="lg" disabled={!mood || !mindset} loading={saving} onClick={save}>
          Save check-in
        </Button>
      </div>
    </main>
  );
}

export default function Page() {
  return (
    <Suspense>
      <CheckIn />
    </Suspense>
  );
}
