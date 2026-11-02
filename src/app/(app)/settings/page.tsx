"use client";

import { useState } from "react";
import { KeyRound, Smartphone } from "lucide-react";
import { api, ApiClientError } from "@/lib/api";
import { useApi } from "@/lib/useApi";
import { useMe } from "@/lib/me";
import { fmtDate, fmtDateTime } from "@/lib/format";
import { PasswordInput, RecoveryCodeCard } from "@/components/AuthBits";
import { Wordmark } from "@/components/Brand";
import { PageHeader } from "@/components/Nav";
import { Sheet } from "@/components/Sheet";
import { useToast } from "@/components/Toast";
import { Button, Card, Label, ListLink, Notice, SectionTitle } from "@/components/ui";

type Sessions = { oneDeviceRule: boolean; sessions: { id: number; label: string; createdAt: number; lastSeenAt: number; current: boolean }[] };

export default function Settings() {
  const { me } = useMe();
  const toast = useToast();
  const sessions = useApi<Sessions>("/api/sessions");
  const [pwOpen, setPwOpen] = useState(false);
  const [rcOpen, setRcOpen] = useState(false);
  const [pw, setPw] = useState({ currentPassword: "", newPassword: "" });
  const [rcPassword, setRcPassword] = useState("");
  const [code, setCode] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function changePassword(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setErr(null);
    try {
      await api("/api/auth/password", { body: pw });
      toast("Password changed. Other devices were signed out.");
      setPw({ currentPassword: "", newPassword: "" });
      setPwOpen(false);
      void sessions.reload();
    } catch (e) {
      setErr(e instanceof ApiClientError ? e.message : "Couldn't change password.");
    } finally {
      setSaving(false);
    }
  }

  async function newCode(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setErr(null);
    try {
      const r = await api<{ recoveryCode: string }>("/api/auth/recovery-code", { body: { password: rcPassword } });
      setCode(r.recoveryCode);
      setRcPassword("");
    } catch (e) {
      setErr(e instanceof ApiClientError ? e.message : "Couldn't create a code.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="mx-auto max-w-[480px] px-4">
      <PageHeader title="Account & security" back="/profile" />
      <Card className="divide-y divide-line overflow-hidden">
        <ListLink icon={<KeyRound className="size-4" />} label="Change password" onClick={() => { setErr(null); setPwOpen(true); }} />
        <ListLink icon={<KeyRound className="size-4" />} label="New recovery code" onClick={() => { setErr(null); setCode(null); setRcOpen(true); }} />
      </Card>

      <SectionTitle>Signed-in devices</SectionTitle>
      {sessions.data?.oneDeviceRule && (
        <div className="mb-2">
          <Notice>Stand-owner accounts can be active on one phone at a time. Signing in on another phone automatically signs this one out.</Notice>
        </div>
      )}
      <Card className="divide-y divide-line">
        {sessions.data?.sessions.map((s) => (
          <div key={s.id} className="flex items-center gap-3 px-4 py-3">
            <Smartphone className="size-5 text-brand-600" />
            <div className="flex-1 text-sm">
              <p className="font-semibold text-ink">
                {s.label} {s.current && <span className="ml-1 rounded-full bg-green-50 px-2 py-0.5 text-[10px] font-bold text-green-700">THIS PHONE</span>}
              </p>
              <p className="text-xs text-muted">Signed in {fmtDate(s.createdAt)} · active {fmtDateTime(s.lastSeenAt)}</p>
            </div>
          </div>
        ))}
      </Card>

      <SectionTitle>Account</SectionTitle>
      <Card className="space-y-1 p-4 text-sm text-ink-2">
        <p>Username: <b>@{me.user.username}</b></p>
        <p>Account type: <b>{me.access.standOwner ? "Stand owner (premade)" : "Standard (self-registered)"}</b></p>
        <p>Created: <b>{fmtDate(me.user.createdAt)}</b></p>
        <p>Plan: <b>{me.access.isPremium ? `Premium until ${fmtDate(me.access.premium.until!)}` : "Freemium"}</b></p>
      </Card>

      <section id="about" className="mt-8 rounded-[20px] bg-white p-5 text-center shadow-[var(--shadow-card)]">
        <Wordmark className="justify-center" />
        <p className="mt-3 text-sm text-ink-2">
          ATHENTIV FocusDock helps students organise deadlines, check in with how they feel, and study in focused sessions with the FocusDock phone stand.
        </p>
        <p className="mt-3 text-xs text-muted">A product by ATHENTIV · Made for Android and iPhone</p>
        <p className="mt-1 text-[11px] text-faint">Mood check-ins are for personal reflection only and are not a medical or psychological service.</p>
      </section>

      <Sheet open={pwOpen} onClose={() => setPwOpen(false)} title="Change password">
        <form onSubmit={changePassword} className="space-y-4">
          {err && <Notice tone="danger">{err}</Notice>}
          <div>
            <Label htmlFor="cp">Current password</Label>
            <PasswordInput id="cp" autoComplete="current-password" value={pw.currentPassword} onChange={(e) => setPw({ ...pw, currentPassword: e.target.value })} />
          </div>
          <div>
            <Label htmlFor="np" hint="8+ chars, a letter and a number">New password</Label>
            <PasswordInput id="np" autoComplete="new-password" value={pw.newPassword} onChange={(e) => setPw({ ...pw, newPassword: e.target.value })} />
          </div>
          <Button type="submit" full loading={saving} disabled={!pw.currentPassword || !pw.newPassword}>
            Change password
          </Button>
        </form>
      </Sheet>
      <Sheet open={rcOpen} onClose={() => setRcOpen(false)} title="New recovery code">
        {code ? (
          <RecoveryCodeCard code={code} />
        ) : (
          <form onSubmit={newCode} className="space-y-4">
            <p className="text-sm text-muted">Your old recovery code will stop working.</p>
            {err && <Notice tone="danger">{err}</Notice>}
            <div>
              <Label htmlFor="rp">Confirm your password</Label>
              <PasswordInput id="rp" autoComplete="current-password" value={rcPassword} onChange={(e) => setRcPassword(e.target.value)} />
            </div>
            <Button type="submit" full loading={saving} disabled={!rcPassword}>
              Generate code
            </Button>
          </form>
        )}
      </Sheet>
    </main>
  );
}
