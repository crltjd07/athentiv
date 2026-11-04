"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronDown, Lightbulb, Music, Pause, Play, Plus, SkipForward, Square, X } from "lucide-react";
import { api, ApiClientError } from "@/lib/api";
import { useMe } from "@/lib/me";
import { ambient } from "@/lib/ambient";
import { fmtClock } from "@/lib/format";
import { systemNotify, vibrate, type PomodoroState } from "@/lib/pomodoro";
import { BREAK_ACTIVITIES } from "@/shared/catalog";
import { DeskIllustration, SleepyCat } from "@/components/Illustrations";
import { ProgressRing } from "@/components/ProgressRing";
import { LockIcon, useApiErrorHandler, useUpgrade } from "@/components/Premium";
import { useConfirm } from "@/components/Sheet";
import { SoundSheet } from "@/components/SoundSheet";
import { AccessDenied, LoadingScreen } from "@/components/SystemScreens";
import { Button, cx } from "@/components/ui";

const FOCUS_LINES = ["Stay focused.\nYou got this!", "One thing at a time.", "Deep work in progress.", "Keep going,\nyou're doing great.", "Phone docked,\nmind on track."];

type WakeLock = { release: () => Promise<void> };

export default function FocusSession() {
  const { me } = useMe();
  const router = useRouter();
  const confirm = useConfirm();
  const upgrade = useUpgrade();
  const onError = useApiErrorHandler();
  const [s, setS] = useState<PomodoroState | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [busy, setBusy] = useState(false);
  const [soundOpen, setSoundOpen] = useState(false);
  const [celebrate, setCelebrate] = useState<{ title: string; sub: string } | null>(null);
  const receivedAt = useRef(Date.now());
  const prev = useRef<{ id: number; kind: "focus" | "break"; planned: number } | null>(null);
  const userEnded = useRef(false);
  const endedEarly = useRef(false);
  const syncing = useRef(false);

  const alert = useCallback(
    (kind: "focus-done" | "break-done") => {
      if (me.alerts.sound) ambient().chime(kind);
      if (me.alerts.vibrate) vibrate(kind === "focus-done" ? [200, 100, 200, 100, 400] : [300, 150, 300]);
    },
    [me.alerts.sound, me.alerts.vibrate],
  );

  const apply = useCallback(
    (next: PomodoroState) => {
      receivedAt.current = Date.now();
      setNow(Date.now());
      const p = prev.current;
      if (p && next.live?.id !== p.id && !userEnded.current) {
        if (p.kind === "focus") {
          alert("focus-done");
          systemNotify("Focus session complete", next.live?.kind === "break" ? "Time for a break." : "Great work!");
          setCelebrate({
            title: endedEarly.current ? "Session saved" : "Session complete! 🎉",
            sub: endedEarly.current ? "The time you focused has been recorded." : `+${Math.round(p.planned / 60)} minutes of focus`,
          });
          setTimeout(() => setCelebrate(null), 3200);
        } else {
          alert("break-done");
          systemNotify("Break is over", "Ready for the next focus session?");
        }
      }
      userEnded.current = false;
      endedEarly.current = false;
      prev.current = next.live ? { id: next.live.id, kind: next.live.kind, planned: next.live.plannedSeconds } : null;
      setS(next);
    },
    [alert],
  );

  const load = useCallback(async () => {
    try {
      apply(await api<PomodoroState>("/api/pomodoro/state"));
    } catch (e) {
      onError(e);
    }
  }, [apply, onError]);

  const act = useCallback(
    async (action: string, id?: number) => {
      const target = id ?? s?.live?.id;
      if (!target) return;
      if (action === "cancel" || action === "skip") userEnded.current = true;
      if (action === "end_early") endedEarly.current = true;
      setBusy(action !== "sync");
      try {
        apply(await api<PomodoroState>(`/api/pomodoro/${target}`, { body: { action } }));
      } catch (e) {
        userEnded.current = false;
        endedEarly.current = false;
        if (e instanceof ApiClientError && e.code === "SESSION_ENDED") void load();
        else onError(e);
      } finally {
        setBusy(false);
      }
    },
    [s?.live?.id, apply, load, onError],
  );

  useEffect(() => {
    void load();
  }, [load]);

  // Local ticking; the server remains the source of truth.
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 250);
    const resync = setInterval(() => void load(), 30_000);
    const onVis = () => document.visibilityState === "visible" && void load();
    document.addEventListener("visibilitychange", onVis);
    return () => {
      clearInterval(t);
      clearInterval(resync);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [load]);

  const live = s?.live ?? null;
  const elapsedSinceFetch = now - receivedAt.current;
  const remaining = live ? (live.status === "active" ? Math.max(0, live.remainingMs - elapsedSinceFetch) : live.remainingMs) : 0;
  const pauseLeft = live?.pauseExpiresInMs != null ? Math.max(0, live.pauseExpiresInMs - elapsedSinceFetch) : null;

  // When the countdown reaches zero (or a pause times out), ask the server to settle.
  useEffect(() => {
    if (!live || syncing.current) return;
    if ((live.status === "active" && remaining <= 0) || (pauseLeft !== null && pauseLeft <= 0)) {
      syncing.current = true;
      void act("sync").finally(() => {
        setTimeout(() => (syncing.current = false), 1500);
      });
    }
  }, [live, remaining, pauseLeft, act]);

  // Keep the screen on while a timer runs (phone sits on the stand).
  useEffect(() => {
    if (!live || live.status !== "active") return;
    let lock: WakeLock | null = null;
    const request = async () => {
      try {
        lock = (await (navigator as Navigator & { wakeLock?: { request: (t: "screen") => Promise<WakeLock> } }).wakeLock?.request("screen")) ?? null;
      } catch {
        /* not supported or denied */
      }
    };
    void request();
    const onVis = () => document.visibilityState === "visible" && void request();
    document.addEventListener("visibilitychange", onVis);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      void lock?.release().catch(() => {});
    };
  }, [live?.id, live?.status]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!me.access.standOwner) return <AccessDenied />;
  if (!s) return <LoadingScreen label="Loading session" />;

  // No running timer: offer the break (if auto-start is off) or go back to setup.
  if (!live) {
    const last = s.last;
    const breakSecs = last?.plannedBreakSeconds ?? 300;
    return (
      <main className="mx-auto flex min-h-dvh max-w-[480px] flex-col items-center justify-center px-6 text-center pt-safe pb-safe">
        {celebrate && <Celebration {...celebrate} />}
        {last?.breakPending && !s.config.autoStartBreak ? (
          <>
            <SleepyCat className="h-36 w-auto" />
            <h1 className="mt-6 text-2xl font-extrabold tracking-tight text-ink">Focus complete 🎉</h1>
            <p className="mt-2 text-sm text-muted">You focused for {Math.round((last.focusedSeconds ?? 0) / 60)} minutes. Take a {Math.round(breakSecs / 60)}-minute break?</p>
            <div className="mt-8 w-full max-w-xs space-y-2.5">
              <Button full size="lg" loading={busy} onClick={() => act("start_break", last.id)}>
                Start {Math.round(breakSecs / 60)}-min break
              </Button>
              <Button full variant="ghost" onClick={() => router.replace("/focus")}>
                Skip break
              </Button>
            </div>
          </>
        ) : (
          <>
            <h1 className="text-2xl font-extrabold tracking-tight text-ink">{last?.status === "cancelled" && last.endReason === "pause_timeout" ? "Session cancelled" : "Nice work!"}</h1>
            <p className="mt-2 max-w-xs text-sm text-muted">
              {last?.status === "cancelled" && last.endReason === "pause_timeout"
                ? "This session was paused for more than 15 minutes, so it was cancelled. Start a fresh one when you're ready."
                : `You've finished ${s.today.completed} focus session${s.today.completed === 1 ? "" : "s"} today.`}
            </p>
            <div className="mt-8 w-full max-w-xs space-y-2.5">
              <Button full size="lg" onClick={() => router.replace("/focus")}>
                Start another session
              </Button>
              <Button full variant="ghost" onClick={() => router.replace("/home")}>
                Back to Home
              </Button>
            </div>
          </>
        )}
      </main>
    );
  }

  const isFocus = live.kind === "focus";
  const paused = live.status === "paused";
  const progress = 1 - remaining / (live.plannedSeconds * 1000);
  const line = FOCUS_LINES[Math.floor((live.plannedSeconds * 1000 - remaining) / 300_000) % FOCUS_LINES.length];
  const tip = BREAK_ACTIVITIES[Math.floor(now / 20_000) % BREAK_ACTIVITIES.length];
  const nextFocusMin = live.preset === "50/10" ? 50 : live.preset === "25/5" ? 25 : s.config.customFocusMinutes;

  return (
    <main className={cx("fixed inset-0 overflow-y-auto", isFocus ? "bg-brand-800 text-white" : "bg-canvas text-ink")}>
      {celebrate && <Celebration {...celebrate} />}
      <div className="mx-auto flex min-h-full max-w-[480px] flex-col px-5 pt-safe pb-safe">
        <div className="flex h-12 items-center justify-between">
          <button aria-label="Minimise. The timer keeps running" onClick={() => router.push("/home")} className={cx("grid size-11 place-items-center rounded-full", isFocus ? "active:bg-white/10" : "active:bg-black/5")}>
            <X className="size-6" />
          </button>
          <h1 className="text-[17px] font-bold">{isFocus ? "Focus Session" : "Break Time"}</h1>
          <button aria-label="Study sounds" onClick={() => setSoundOpen(true)} className={cx("grid size-11 place-items-center rounded-full", isFocus ? "active:bg-white/10" : "active:bg-black/5")}>
            <Music className="size-5" />
          </button>
        </div>
        {isFocus && (
          <p className="truncate text-center text-sm text-brand-200">
            {live.task ? `${live.task.title}${live.task.subject ? `  •  ${live.task.subject.name}` : ""}` : "General study"}
          </p>
        )}

        <div className="mt-6 flex justify-center">
          <ProgressRing value={progress} size={264} stroke={12} color={isFocus ? "#FFFFFF" : "#2F5BEA"} track={isFocus ? "rgba(255,255,255,0.16)" : "#DCE6FF"}>
            <div className="text-center">
              <div className={cx("text-[64px] font-extrabold leading-none tracking-tight tabular", paused && "opacity-60")} aria-live="off">
                {fmtClock(remaining)}
              </div>
              <div className={cx("mt-2 text-base font-medium", isFocus ? "text-brand-200" : "text-muted")}>{paused ? "Paused" : isFocus ? "Focus" : "Break"}</div>
            </div>
          </ProgressRing>
        </div>

        {paused && pauseLeft !== null && (
          <p className={cx("mt-3 text-center text-xs font-semibold", isFocus ? "text-amber-200" : "text-amber-700")}>Auto-cancels in {fmtClock(pauseLeft)} if not resumed</p>
        )}

        {isFocus ? (
          <>
            <DeskIllustration className="mx-auto mt-6 h-28 w-auto" />
            <p className="mt-4 whitespace-pre-line text-center text-lg font-semibold">{line}</p>
          </>
        ) : (
          <>
            <SleepyCat className="mx-auto mt-4 h-32 w-auto animate-float" />
            <p className="mx-auto mt-3 max-w-xs text-center text-lg font-semibold text-ink">{tip}</p>
          </>
        )}

        <div className="mt-auto pt-8">
          {isFocus ? (
            <div className="flex items-center gap-3 rounded-full border border-white/20 bg-white/10 p-2 backdrop-blur">
              <button
                aria-label={paused ? "Resume" : "Pause"}
                disabled={busy}
                onClick={() => act(paused ? "resume" : "pause")}
                className="grid size-14 place-items-center rounded-full bg-white text-brand-800 active:scale-95"
              >
                {paused ? <Play className="size-6 fill-current" /> : <Pause className="size-6 fill-current" />}
              </button>
              <span className="flex-1 text-[15px] font-semibold">{paused ? "Resume" : "Pause"}</span>
              <button
                disabled={busy}
                onClick={async () => {
                  if (await confirm({ title: "End this session early?", body: "The time you've focused so far will be saved.", confirmLabel: "End early" })) void act("end_early");
                }}
                className="h-11 rounded-full bg-white/15 px-5 text-sm font-semibold active:bg-white/25"
              >
                End Early
              </button>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3">
                <Button size="lg" loading={busy} icon={paused ? <Play className="size-5" /> : <Pause className="size-5" />} onClick={() => act(paused ? "resume" : "pause")}>
                  {paused ? "Resume" : "Pause"}
                </Button>
                <Button size="lg" variant="secondary" disabled={busy} icon={<SkipForward className="size-5" />} onClick={() => act("skip")}>
                  Skip
                </Button>
              </div>
              <button
                onClick={() => (live.canExtend ? act("extend") : !me.access.features.breakExtend ? upgrade("Extending breaks") : undefined)}
                disabled={busy || (me.access.features.breakExtend && !live.canExtend)}
                className="mt-3 flex w-full items-center justify-center gap-1.5 text-sm font-semibold text-brand-700 disabled:text-faint"
              >
                <Plus className="size-4" /> Extend break by 5 min {!me.access.features.breakExtend && <LockIcon />}
                {me.access.features.breakExtend && !live.canExtend && "(limit reached)"}
              </button>
              <div className="mt-4 flex items-center gap-3 rounded-2xl bg-white p-4 shadow-[var(--shadow-card)]">
                <Lightbulb className="size-5 text-brand-600" />
                <div className="flex-1">
                  <p className="text-sm font-semibold text-ink">Next up</p>
                  <p className="text-xs text-muted">Focus for {nextFocusMin} minutes{live.task ? ` on ${live.task.title}` : ""}</p>
                </div>
              </div>
            </>
          )}
          {isFocus && (
            <button
              disabled={busy}
              onClick={async () => {
                if (await confirm({ title: "Cancel this session?", body: "Cancelled sessions aren't counted toward your focus time.", confirmLabel: "Cancel session", danger: true })) void act("cancel");
              }}
              className="mx-auto mt-4 flex items-center gap-1.5 text-sm font-medium text-brand-200"
            >
              <Square className="size-3.5" /> Cancel session
            </button>
          )}
          <button aria-label="Minimise" onClick={() => router.push("/home")} className={cx("mx-auto mt-3 grid size-10 place-items-center", isFocus ? "text-brand-300" : "text-faint")}>
            <ChevronDown className="size-6" />
          </button>
        </div>
      </div>
      <SoundSheet open={soundOpen} onClose={() => setSoundOpen(false)} />
    </main>
  );
}

function Celebration({ title, sub }: { title: string; sub: string }) {
  return (
    <div className="pointer-events-none fixed inset-0 z-50 flex flex-col items-center justify-center bg-brand-900/70 text-center text-white backdrop-blur-sm animate-fade-up">
      <div className="text-6xl animate-pop">🏆</div>
      <p className="mt-4 text-2xl font-extrabold">{title}</p>
      <p className="mt-1 text-brand-100">{sub}</p>
    </div>
  );
}
