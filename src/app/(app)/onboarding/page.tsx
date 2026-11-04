"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Check, Lock } from "lucide-react";
import { api, ApiClientError } from "@/lib/api";
import { useMe } from "@/lib/me";
import { AVATARS, SUBJECT_PRESETS } from "@/shared/catalog";
import { Avatar } from "@/components/Avatar";
import { Wordmark } from "@/components/Brand";
import { PasswordInput, RecoveryCodeCard } from "@/components/AuthBits";
import { SubjectIcon } from "@/components/SubjectIcon";
import { useToast } from "@/components/Toast";
import { Button, Label, Notice, cx } from "@/components/ui";

const GOALS = [60, 90, 120, 180, 240];

export default function Onboarding() {
  const { me, refresh } = useMe();
  const router = useRouter();
  const toast = useToast();
  const needsPassword = me.user.mustChangePassword;
  const steps = [...(needsPassword ? (["password", "recovery"] as const) : []), "avatar", "subjects", "goal"] as const;
  const [step, setStep] = useState(0);
  const [avatar, setAvatar] = useState(me.profile.avatarKey);
  const [picked, setPicked] = useState<string[]>([]);
  const [goal, setGoal] = useState(me.profile.dailyGoalMinutes);
  const [pw, setPw] = useState({ current: "", next: "" });
  const [pwErr, setPwErr] = useState<string | null>(null);
  const [recovery, setRecovery] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const current = steps[step];

  async function changePassword() {
    setSaving(true);
    setPwErr(null);
    try {
      await api("/api/auth/password", { body: { currentPassword: pw.current, newPassword: pw.next } });
      const r = await api<{ recoveryCode: string }>("/api/auth/recovery-code", { body: { password: pw.next } });
      setRecovery(r.recoveryCode);
      setStep((s) => s + 1);
    } catch (e) {
      setPwErr(e instanceof ApiClientError ? e.message : "Couldn't update password.");
    } finally {
      setSaving(false);
    }
  }

  async function finish() {
    setSaving(true);
    try {
      if (picked.length) {
        await api("/api/subjects", { body: { subjects: SUBJECT_PRESETS.filter((p) => picked.includes(p.name)) } });
      }
      await api("/api/profile", { method: "PATCH", body: { avatarKey: avatar, dailyGoalMinutes: goal, onboarded: true } });
      await refresh();
      toast(`Welcome to ATHENTIV FocusDock, ${me.profile.displayName}.`);
      router.replace(me.access.standOwner && !me.access.nfc.verified ? "/stand" : "/home");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Couldn't save.", "error");
      setSaving(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-[480px] flex-col px-5 pt-safe pb-safe">
      <div className="flex items-center justify-between pt-5">
        <Wordmark />
        <span className="text-xs font-semibold text-muted">
          {step + 1} / {steps.length}
        </span>
      </div>
      <div className="mt-4 flex gap-1.5">
        {steps.map((s, i) => <span key={s} className={cx("h-1.5 flex-1 rounded-full", i <= step ? "bg-brand-700" : "bg-brand-100")} />)}
      </div>

      <div key={current} className="mt-8 flex-1 animate-fade-up">
        {current === "password" && (
          <>
            <h1 className="text-[26px] font-extrabold tracking-tight text-ink">Secure your stand account</h1>
            <p className="mt-2 text-sm text-muted">Your FocusDock stand came with a temporary password. Choose your own to continue.</p>
            <div className="mt-6 space-y-4">
              {pwErr && <Notice tone="danger">{pwErr}</Notice>}
              <div>
                <Label htmlFor="cur">Temporary password</Label>
                <PasswordInput id="cur" autoComplete="current-password" value={pw.current} onChange={(e) => setPw({ ...pw, current: e.target.value })} />
              </div>
              <div>
                <Label htmlFor="new" hint="8+ chars, a letter and a number">New password</Label>
                <PasswordInput id="new" autoComplete="new-password" value={pw.next} onChange={(e) => setPw({ ...pw, next: e.target.value })} />
              </div>
            </div>
          </>
        )}
        {current === "recovery" && recovery && (
          <>
            <h1 className="text-[26px] font-extrabold tracking-tight text-ink">Save your recovery code</h1>
            <p className="mt-2 mb-6 text-sm text-muted">If you ever forget your password, this code lets you reset it.</p>
            <RecoveryCodeCard code={recovery} />
          </>
        )}
        {current === "avatar" && (
          <>
            <h1 className="text-[26px] font-extrabold tracking-tight text-ink">Pick your study buddy</h1>
            <p className="mt-2 text-sm text-muted">You can change it any time from your profile.</p>
            <div className="mt-6 flex justify-center">
              <Avatar avatarKey={avatar} size={104} className="animate-pop" key={avatar} />
            </div>
            <div className="mt-6 grid grid-cols-4 gap-3">
              {AVATARS.map((a) => {
                const locked = a.tier === "premium" && !me.access.features.premiumAvatars;
                return (
                  <button
                    key={a.key}
                    disabled={locked}
                    onClick={() => setAvatar(a.key)}
                    aria-pressed={avatar === a.key}
                    className={cx("relative flex flex-col items-center gap-1 rounded-2xl border-2 bg-white py-2.5", avatar === a.key ? "border-brand-600" : "border-transparent", locked && "opacity-60")}
                  >
                    <Avatar avatarKey={a.key} size={48} />
                    <span className="text-xs font-medium text-ink-2">{a.name}</span>
                    {locked && <Lock className="absolute top-1.5 right-1.5 size-3.5 text-amber-500" />}
                  </button>
                );
              })}
            </div>
            {!me.access.features.premiumAvatars && <p className="mt-3 text-center text-xs text-muted">Robot, Rocket, Frog and Star are Premium avatars.</p>}
          </>
        )}
        {current === "subjects" && (
          <>
            <h1 className="text-[26px] font-extrabold tracking-tight text-ink">What are you studying?</h1>
            <p className="mt-2 text-sm text-muted">Pick a few subjects to start. You can add your own later.</p>
            <div className="mt-6 grid grid-cols-2 gap-2.5">
              {SUBJECT_PRESETS.map((p) => {
                const on = picked.includes(p.name);
                return (
                  <button
                    key={p.name}
                    onClick={() => setPicked((xs) => (on ? xs.filter((x) => x !== p.name) : [...xs, p.name]))}
                    aria-pressed={on}
                    className={cx("flex items-center gap-2.5 rounded-2xl border-2 bg-white p-2.5 text-left", on ? "border-brand-600" : "border-line")}
                  >
                    <SubjectIcon icon={p.icon} color={p.color} size={32} />
                    <span className="flex-1 truncate text-sm font-semibold text-ink">{p.name}</span>
                    {on && <Check className="size-4 text-brand-700" strokeWidth={3} />}
                  </button>
                );
              })}
            </div>
          </>
        )}
        {current === "goal" && (
          <>
            <h1 className="text-[26px] font-extrabold tracking-tight text-ink">Set a daily study goal</h1>
            <p className="mt-2 text-sm text-muted">{me.access.standOwner ? "Your Today's Progress ring fills as you complete focus sessions." : "A target to aim for. You can change it later."}</p>
            <div className="mt-8 grid grid-cols-3 gap-2.5">
              {GOALS.map((g) => (
                <button key={g} onClick={() => setGoal(g)} className={cx("rounded-2xl border-2 bg-white py-4 text-center", goal === g ? "border-brand-600 text-brand-700" : "border-line text-ink")}>
                  <span className="block text-xl font-extrabold">{g >= 60 ? `${g / 60}h` : `${g}m`}</span>
                  <span className="text-xs text-muted">per day</span>
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      <div className="space-y-2 pt-6">
        {current === "password" ? (
          <Button full size="lg" loading={saving} disabled={!pw.current || !pw.next} onClick={changePassword}>
            Update password
          </Button>
        ) : current === "goal" ? (
          <Button full size="lg" loading={saving} onClick={finish}>
            Start using FocusDock
          </Button>
        ) : (
          <Button full size="lg" onClick={() => setStep((s) => s + 1)}>
            {current === "recovery" ? "I've saved it" : "Continue"}
          </Button>
        )}
        {current !== "password" && current !== "recovery" && step > (needsPassword ? 2 : 0) && (
          <Button full variant="ghost" onClick={() => setStep((s) => s - 1)}>
            Back
          </Button>
        )}
      </div>
    </main>
  );
}
