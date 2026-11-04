"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { GraduationCap, History, Music, Settings2 } from "lucide-react";
import { api, ApiClientError } from "@/lib/api";
import { useApi } from "@/lib/useApi";
import { useMe } from "@/lib/me";
import { requestNotifyPermission, type PomodoroState } from "@/lib/pomodoro";
import { useWebNfc } from "@/lib/webnfc";
import { fmtDue } from "@/lib/format";
import { LIMITS } from "@/shared/limits";
import { taskTypeLabel } from "@/shared/catalog";
import { PageHeader } from "@/components/Nav";
import { LockIcon, useApiErrorHandler, useUpgrade } from "@/components/Premium";
import { Sheet } from "@/components/Sheet";
import { SoundSheet, useAmbient } from "@/components/SoundSheet";
import { SubjectIcon } from "@/components/SubjectIcon";
import { AccessDenied, NfcRequired } from "@/components/SystemScreens";
import { EffortBadge, type Task } from "@/components/TaskBits";
import { useToast } from "@/components/Toast";
import { Button, Card, ErrorState, Input, Label, PageSkeleton, Segmented, Toggle, cx } from "@/components/ui";

type Preset = "25/5" | "50/10" | "custom";

function FocusSetup() {
  const { me, refresh } = useMe();
  const router = useRouter();
  const params = useSearchParams();
  const upgrade = useUpgrade();
  const onError = useApiErrorHandler();
  const toast = useToast();
  const nfc = useWebNfc();
  const sound = useAmbient();
  const premium = me.access.features.pomodoroCustom;

  const state = useApi<PomodoroState>(me.access.standOwner ? "/api/pomodoro/state" : null);
  const tasks = useApi<{ items: Task[] }>(me.access.standOwner ? "/api/tasks?status=open&sort=due" : null);
  const [preset, setPreset] = useState<Preset>("25/5");
  const [focusMin, setFocusMin] = useState(40);
  const [breakMin, setBreakMin] = useState(8);
  const [taskId, setTaskId] = useState<number | null>(params.get("task") ? Number(params.get("task")) : null);
  const [starting, setStarting] = useState(false);
  const [soundOpen, setSoundOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  useEffect(() => {
    const s = state.data;
    if (!s) return;
    if (s.live) router.replace("/focus/session");
    setPreset(premium ? s.config.preset : "25/5");
    setFocusMin(s.config.customFocusMinutes);
    setBreakMin(s.config.customBreakMinutes);
  }, [state.data, premium, router]);

  if (!me.access.standOwner) return <AccessDenied />;

  async function scan() {
    try {
      const proof = await nfc.scan();
      const r = await api<{ status: string; newSession: boolean; verificationId: number; trialGranted: boolean }>("/api/nfc/verify", { body: proof });
      await refresh();
      await state.reload();
      toast(r.trialGranted ? "Stand verified. Your 30-day Premium trial has started!" : "Stand verified");
      if (r.newSession) router.push(`/checkin?v=${r.verificationId}`);
    } catch (e) {
      toast(e instanceof Error ? e.message : "Couldn't verify the stand.", "error");
    }
  }

  async function start() {
    setStarting(true);
    void requestNotifyPermission();
    try {
      await api("/api/pomodoro/start", {
        body: { preset, taskId, ...(preset === "custom" ? { focusMinutes: focusMin, breakMinutes: breakMin } : {}) },
      });
      router.push("/focus/session");
    } catch (e) {
      if (e instanceof ApiClientError && e.code === "NFC_REQUIRED") await refresh();
      if (e instanceof ApiClientError && e.code === "DAILY_LIMIT") upgrade("Unlimited focus sessions");
      else onError(e);
      setStarting(false);
      void state.reload();
    }
  }

  async function saveConfig(patch: Partial<PomodoroState["config"]>) {
    try {
      const s = await api<PomodoroState>("/api/pomodoro/config", { method: "PUT", body: patch });
      state.setData({ ...s, nfc: state.data!.nfc });
    } catch (e) {
      onError(e);
    }
  }

  const s = state.data;
  const verified = me.access.nfc.verified;
  const outOfSessions = s?.today.remaining === 0;

  return (
    <main className="mx-auto max-w-[480px] px-4">
      <PageHeader
        title="Focus Timer"
        action={
          <button aria-label="Timer settings" onClick={() => setSettingsOpen(true)} className="grid size-11 place-items-center rounded-full text-ink-2 active:bg-black/5">
            <Settings2 className="size-5" />
          </button>
        }
      />

      {state.error ? (
        <ErrorState message={state.error.message} onRetry={state.reload} />
      ) : !s ? (
        <PageSkeleton />
      ) : !verified ? (
        <NfcRequired scanSupported={nfc.supported} scanning={nfc.scanning} onScan={scan} />
      ) : (
        <>
          <Segmented<Preset>
            value={preset}
            onChange={(v) => (v !== "25/5" && !premium ? upgrade(v === "custom" ? "Custom focus durations" : "The 50/10 preset") : setPreset(v))}
            options={[
              { value: "25/5", label: "25/5" },
              { value: "50/10", label: <>50/10 {!premium && <LockIcon className="size-4" />}</> },
              { value: "custom", label: <>Custom {!premium && <LockIcon className="size-4" />}</> },
            ]}
          />
          {preset === "custom" && (
            <div className="mt-3 grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="fm" hint={`${LIMITS.customFocusMinutes.min}–${LIMITS.customFocusMinutes.max}`}>Focus (min)</Label>
                <Input id="fm" type="number" inputMode="numeric" min={1} max={180} value={focusMin} onChange={(e) => setFocusMin(Math.max(1, Math.min(180, Number(e.target.value) || 1)))} />
              </div>
              <div>
                <Label htmlFor="bm" hint={`${LIMITS.customBreakMinutes.min}–${LIMITS.customBreakMinutes.max}`}>Break (min)</Label>
                <Input id="bm" type="number" inputMode="numeric" min={1} max={60} value={breakMin} onChange={(e) => setBreakMin(Math.max(1, Math.min(60, Number(e.target.value) || 1)))} />
              </div>
            </div>
          )}

          <div className="mt-3 flex items-center justify-between rounded-2xl bg-white px-4 py-3 text-sm shadow-[var(--shadow-card)]">
            <span className="text-muted">Today</span>
            <span className="font-semibold text-ink tabular">
              {s.today.completed} completed · {s.today.focusMinutes} min
            </span>
            {s.today.limit !== null && (
              <span className={cx("rounded-full px-2.5 py-1 text-xs font-bold", outOfSessions ? "bg-red-50 text-red-600" : "bg-brand-50 text-brand-700")}>
                {s.today.remaining}/{s.today.limit} left
              </span>
            )}
          </div>

          <Card className="mt-4 p-4">
            <h2 className="font-bold text-ink">Select a Task</h2>
            <p className="text-xs text-muted">Link your session to a task and subject.</p>
            <ul className="mt-3 space-y-2" role="radiogroup">
              {(tasks.data?.items ?? []).map((t) => (
                <li key={t.id}>
                  <button role="radio" aria-checked={taskId === t.id} onClick={() => setTaskId(t.id)} className={cx("flex w-full items-center gap-3 rounded-2xl border-2 p-2.5 text-left", taskId === t.id ? "border-brand-600 bg-brand-50/50" : "border-line")}>
                    <SubjectIcon icon={t.subject?.icon} color={t.subject?.color} size={38} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-ink">{t.title}</p>
                      <p className="truncate text-xs text-muted">
                        {t.subject?.name ?? taskTypeLabel(t.type)} · {fmtDue(t.dueAt)}
                        {t.focusMinutes > 0 && ` · ${t.focusMinutes}m focused`}
                      </p>
                    </div>
                    <EffortBadge effort={t.effort} />
                  </button>
                </li>
              ))}
              <li>
                <button role="radio" aria-checked={taskId === null} onClick={() => setTaskId(null)} className={cx("flex w-full items-center gap-3 rounded-2xl border-2 p-2.5 text-left", taskId === null ? "border-brand-600 bg-brand-50/50" : "border-line")}>
                  <span className="grid size-[38px] place-items-center rounded-xl bg-slate-100 text-ink-2">
                    <GraduationCap className="size-5" />
                  </span>
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-ink">General study</p>
                    <p className="text-xs text-muted">No specific task</p>
                  </div>
                </button>
              </li>
            </ul>
          </Card>

          <button onClick={() => setSoundOpen(true)} className="mt-3 flex w-full items-center gap-3 rounded-2xl bg-white px-4 py-3 text-left shadow-[var(--shadow-card)]">
            <span className={cx("grid size-9 place-items-center rounded-xl", sound.playing ? "bg-brand-700 text-white" : "bg-brand-50 text-brand-700")}>
              <Music className="size-4" />
            </span>
            <span className="flex-1 text-sm font-medium text-ink">{sound.playing ? `Playing: ${sound.sound}` : "Add study sounds or Spotify"}</span>
            <span className="text-xs font-semibold text-brand-700">{sound.playing ? "Change" : "Choose"}</span>
          </button>

          <Button full size="lg" className="mt-5" loading={starting} onClick={() => (outOfSessions ? upgrade("Unlimited focus sessions") : start())}>
            {outOfSessions ? "Daily limit reached" : "Start"}
          </Button>
          <Link href="/focus/history" className="mt-3 flex items-center justify-center gap-1.5 text-sm font-semibold text-brand-700">
            <History className="size-4" /> Session history
          </Link>
        </>
      )}

      <SoundSheet open={soundOpen} onClose={() => setSoundOpen(false)} />
      <Sheet open={settingsOpen} onClose={() => setSettingsOpen(false)} title="Timer settings">
        {s && (
          <div className="-mx-4 divide-y divide-line">
            <Toggle label="Start breaks automatically" description="Go straight into your break when focus ends." checked={s.config.autoStartBreak} onChange={(v) => saveConfig({ autoStartBreak: v })} />
            <div className="flex items-center gap-3 px-4 py-3">
              <span className="flex-1">
                <span className="block text-[15px] font-medium text-ink">Daily session goal</span>
                <span className="block text-xs text-muted">Sessions you aim to finish each day.</span>
              </span>
              <div className="flex items-center gap-2">
                <button aria-label="Fewer" onClick={() => saveConfig({ dailyGoalSessions: Math.max(1, s.config.dailyGoalSessions - 1) })} className="grid size-9 place-items-center rounded-full bg-slate-100 font-bold">−</button>
                <span className="w-6 text-center font-bold tabular">{s.config.dailyGoalSessions}</span>
                <button aria-label="More" onClick={() => saveConfig({ dailyGoalSessions: Math.min(24, s.config.dailyGoalSessions + 1) })} className="grid size-9 place-items-center rounded-full bg-slate-100 font-bold">+</button>
              </div>
            </div>
          </div>
        )}
        <p className="mt-3 text-xs text-muted">Paused sessions are cancelled automatically after {LIMITS.pauseMaxMs / 60_000} minutes.</p>
      </Sheet>
    </main>
  );
}

export default function Page() {
  return (
    <Suspense>
      <FocusSetup />
    </Suspense>
  );
}
