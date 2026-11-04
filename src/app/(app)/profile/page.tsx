"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Award, Bell, BookMarked, BookOpen, CalendarDays, Crown, HeartPulse, Info, LogOut, Moon, Nfc, Pencil, Shield, Smile } from "lucide-react";
import { api } from "@/lib/api";
import { useMe } from "@/lib/me";
import { useTheme } from "@/lib/theme";
import { daysLeftLabel, fmtDate } from "@/lib/format";
import { Avatar } from "@/components/Avatar";
import { PremiumBadge } from "@/components/Premium";
import { useConfirm } from "@/components/Sheet";
import { Card, ListLink, ProgressBar, SectionTitle, Toggle } from "@/components/ui";

const SCROLL_KEY = "fd:profile-scroll";

export default function Profile() {
  const { me } = useMe();
  const router = useRouter();
  const confirm = useConfirm();
  const [theme, setTheme] = useTheme();
  const p = me.access.premium;

  // Coming back from a Profile sub-screen returns to the same spot in the menu.
  useEffect(() => {
    try {
      const saved = JSON.parse(sessionStorage.getItem(SCROLL_KEY) ?? "null") as { y: number; t: number } | null;
      sessionStorage.removeItem(SCROLL_KEY);
      if (saved && Date.now() - saved.t < 10 * 60_000) {
        requestAnimationFrame(() => requestAnimationFrame(() => window.scrollTo(0, saved.y)));
      }
    } catch {
      /* storage unavailable */
    }
  }, []);

  function rememberScroll(e: React.MouseEvent) {
    if (!(e.target as Element).closest("a")) return;
    try {
      sessionStorage.setItem(SCROLL_KEY, JSON.stringify({ y: window.scrollY, t: Date.now() }));
    } catch {
      /* storage unavailable */
    }
  }

  async function logout() {
    if (!(await confirm({ title: "Sign out?", body: me.access.standOwner ? "You'll need to sign in and tap your stand again to use Focus." : undefined, confirmLabel: "Sign out" }))) return;
    await api("/api/auth/logout", { body: {} }).catch(() => {});
    router.replace("/welcome");
  }

  return (
    <main className="mx-auto max-w-[480px] px-4 pt-safe" onClickCapture={rememberScroll}>
      <h1 className="pt-4 text-[26px] font-extrabold tracking-tight text-ink">Profile</h1>

      <Card className="mt-3 p-5 text-center">
        <Link href="/profile/avatar" className="relative mx-auto inline-block">
          <Avatar avatarKey={me.profile.avatarKey} size={88} ring />
          <span className="absolute -right-1 bottom-0 grid size-8 place-items-center rounded-full border-2 border-white bg-brand-700 text-white">
            <Pencil className="size-3.5" />
          </span>
        </Link>
        <h2 className="mt-3 text-xl font-extrabold text-ink">{me.profile.displayName}</h2>
        <p className="text-sm text-muted">@{me.user.username}</p>
        <div className="mt-2 flex flex-wrap justify-center gap-1.5">
          <span className="inline-flex h-6 items-center gap-1 rounded-full bg-brand-50 px-2.5 text-[11px] font-bold text-brand-700">
            {me.access.standOwner ? <><Nfc className="size-3.5" /> Stand owner{me.stand ? ` · ${me.stand.code}` : ""}</> : "Standard account"}
          </span>
          {p.active ? <PremiumBadge label={p.source === "trial" ? "Premium trial" : "Premium"} /> : <span className="inline-flex h-6 items-center rounded-full bg-slate-100 px-2.5 text-[11px] font-bold text-ink-2">Freemium</span>}
        </div>
        {(me.profile.school || me.profile.course) && (
          <p className="mt-2 text-xs text-muted">{[me.profile.course, me.profile.yearLevel, me.profile.school].filter(Boolean).join(" · ")}</p>
        )}
        <p className="mt-1 text-xs text-faint">Member since {fmtDate(me.user.createdAt)}</p>
      </Card>

      {me.completion.percent < 100 && (
        <Link href="/profile/edit" className="mt-3 block rounded-[20px] border border-line bg-white p-4">
          <div className="flex items-center justify-between text-sm">
            <span className="font-semibold text-ink">Profile {me.completion.percent}% complete</span>
            <span className="text-xs font-semibold text-brand-700">Finish →</span>
          </div>
          <ProgressBar value={me.completion.percent} className="mt-2" />
          <p className="mt-2 text-xs text-muted">Missing: {me.completion.checks.filter((c) => !c.done).map((c) => c.label.toLowerCase()).join(", ")}</p>
        </Link>
      )}

      <Link href="/premium" className="mt-3 flex items-center gap-3 rounded-[20px] bg-gradient-to-r from-brand-700 to-brand-900 p-4 text-white">
        <Crown className="size-6 text-amber-300" />
        <span className="flex-1">
          <span className="block font-bold">{p.active ? "Premium is active" : "Upgrade to Premium"}</span>
          <span className="block text-xs text-brand-100">{p.active ? `${daysLeftLabel(p.until)} · ends ${fmtDate(p.until!)}` : "Unlimited tasks, analytics, exports and more"}</span>
        </span>
      </Link>

      <SectionTitle>Account</SectionTitle>
      <Card className="divide-y divide-line overflow-hidden">
        <ListLink href="/profile/edit" icon={<Pencil className="size-4" />} label="Edit profile" />
        <ListLink href="/profile/avatar" icon={<Smile className="size-4" />} label="Avatar" />
        <ListLink href="/subjects" icon={<BookMarked className="size-4" />} label="Subjects" detail={String(me.subjectCount)} />
        <ListLink href="/profile/achievements" icon={<Award className="size-4" />} label="Achievements & streaks" />
        {me.access.standOwner && <ListLink href="/stand" icon={<Nfc className="size-4" />} label="My stand & session" detail={me.access.nfc.verified ? "Verified" : "Tap to verify"} />}
        {me.access.standOwner && <ListLink href="/mood" icon={<HeartPulse className="size-4" />} label="Mood history" />}
        {me.access.standOwner && <ListLink href="/calendar" icon={<CalendarDays className="size-4" />} label="Academic calendar" />}
      </Card>

      <SectionTitle>Settings</SectionTitle>
      <Card className="divide-y divide-line overflow-hidden">
        <ListLink href="/notifications" icon={<Bell className="size-4" />} label="Notifications" detail={me.unreadNotifications ? `${me.unreadNotifications} new` : undefined} />
        <ListLink href="/settings/notifications" icon={<Bell className="size-4" />} label="Notification preferences" />
        <ListLink href="/settings" icon={<Shield className="size-4" />} label="Account & security" />
        <div className="flex items-center pl-4">
          <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-700"><Moon className="size-4" /></span>
          <div className="-ml-1 flex-1">
            <Toggle label="Dark mode" description="Saved on this phone." checked={theme === "dark"} onChange={(on) => setTheme(on ? "dark" : "light")} />
          </div>
        </div>
        <ListLink href="/manual" icon={<BookOpen className="size-4" />} label="User manual" />
        <ListLink href="/about" icon={<Info className="size-4" />} label="About ATHENTIV FocusDock" />
        <ListLink icon={<LogOut className="size-4" />} label="Sign out" onClick={logout} danger />
      </Card>
      <p className="mt-6 text-center text-xs text-faint">ATHENTIV FocusDock · by ATHENTIV</p>
    </main>
  );
}
