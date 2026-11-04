"use client";

import Link from "next/link";
import { Bell, CalendarDays, ChartColumn, ChevronRight, Flame, Lightbulb, ListChecks, Nfc, Plus, ShieldCheck, Timer } from "lucide-react";
import { useMe } from "@/lib/me";
import { useApi } from "@/lib/useApi";
import { api } from "@/lib/api";
import { fmtMinutes, fmtTime, greeting } from "@/lib/format";
import { moodOf, mindsetOf } from "@/shared/catalog";
import { Avatar } from "@/components/Avatar";
import { ProgressRing } from "@/components/ProgressRing";
import { TaskCard, type Task } from "@/components/TaskBits";
import { useApiErrorHandler } from "@/components/Premium";
import { useToast } from "@/components/Toast";
import { Card, EmptyState, ErrorState, PageSkeleton, SectionTitle, cx } from "@/components/ui";

type Dashboard = {
  today: { focusMinutes: number; focusSessions: number; goalMinutes: number; tasksCompleted: number; tasksDue: number; tasksDueDone: number };
  streak: { current: number; best: number; activeToday: boolean };
  openCount: number;
  overdueCount: number;
  upcoming: Task[];
  dueToday: Task[];
  checkin: { mood: string; mindset: string; at: number } | null;
  recommendations: { id: string; text: string; action?: { label: string; href: string } }[];
  liveSession: { id: number; kind: string; status: string } | null;
};

export default function Home() {
  const { me } = useMe();
  const { data, error, loading, reload } = useApi<Dashboard>("/api/dashboard");
  const onError = useApiErrorHandler();
  const toast = useToast();
  const stand = me.access.standOwner;
  const verified = me.access.nfc.verified;

  async function toggle(t: Task) {
    try {
      await api(`/api/tasks/${t.id}/status`, { body: { status: t.status === "completed" ? "pending" : "completed" } });
      if (t.status !== "completed") toast("Task completed");
      await reload();
    } catch (e) {
      onError(e);
    }
  }

  const quick = [
    stand ? { href: "/focus", label: "Focus Timer", icon: Timer } : { href: "/calendar", label: "Calendar", icon: CalendarDays },
    { href: "/tasks", label: "Tasks", icon: ListChecks },
    { href: "/summary", label: "Summary", icon: ChartColumn },
    stand ? { href: "/calendar", label: "Calendar", icon: CalendarDays } : { href: "/tasks/new", label: "Add task", icon: Plus },
  ];

  return (
    <main className="mx-auto max-w-[480px] px-4 pt-safe">
      <header className="flex items-start justify-between pt-4">
        <div className="min-w-0">
          <h1 className="text-[26px] font-extrabold leading-tight tracking-tight text-ink">
            {greeting()},
            <br />
            <span className="text-brand-700">{me.profile.displayName}</span> 🎓
          </h1>
          <p className="mt-1 text-sm text-muted">Small steps today, big results tomorrow.</p>
        </div>
        <div className="flex items-center gap-1">
          <Link href="/notifications" aria-label="Notifications" className="relative grid size-11 place-items-center rounded-full text-ink-2 active:bg-black/5">
            <Bell className="size-6" />
            {me.unreadNotifications > 0 && (
              <span className="absolute top-1.5 right-1.5 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
                {me.unreadNotifications > 9 ? "9+" : me.unreadNotifications}
              </span>
            )}
          </Link>
          <Link href="/profile" aria-label="Profile">
            <Avatar avatarKey={me.profile.avatarKey} size={44} ring />
          </Link>
        </div>
      </header>

      {stand && (
        <Link
          href={verified ? "/focus" : "/stand"}
          className={cx("mt-4 flex items-center gap-3 rounded-2xl px-4 py-3 text-sm", verified ? "bg-green-50 text-green-800" : "bg-brand-700 text-white shadow-[var(--shadow-float)]")}
        >
          {verified ? <ShieldCheck className="size-5 shrink-0" /> : <Nfc className="size-5 shrink-0" />}
          <span className="flex-1">
            {verified ? (
              <>
                <span className="font-semibold">Docked & verified</span> · Focus and Check-in are unlocked
              </>
            ) : (
              <>
                <span className="font-semibold">Tap your stand</span> to unlock Focus and Check-in
              </>
            )}
          </span>
          <ChevronRight className="size-4 shrink-0 opacity-70" />
        </Link>
      )}

      {data?.liveSession && (
        <Link href="/focus/session" className="mt-3 flex items-center gap-3 rounded-2xl bg-brand-900 px-4 py-3 text-sm text-white">
          <Timer className="size-5 animate-pulse" />
          <span className="flex-1 font-semibold">{data.liveSession.kind === "focus" ? "Focus session" : "Break"} {data.liveSession.status === "paused" ? "paused" : "in progress"}</span>
          <span className="text-brand-200">Resume →</span>
        </Link>
      )}

      {loading && !data ? (
        <PageSkeleton />
      ) : error ? (
        <ErrorState message={error.message} onRetry={reload} />
      ) : data ? (
        <>
          <Card className="mt-4 p-4">
            <Link href="/summary" className="flex items-center justify-between">
              <h2 className="font-bold text-ink">Today&apos;s Progress</h2>
              <ChevronRight className="size-5 text-faint" />
            </Link>
            <div className="mt-3 flex items-center gap-5">
              {stand ? (
                <ProgressRing value={data.today.focusMinutes / data.today.goalMinutes} size={96} stroke={10}>
                  <span className="text-xl font-extrabold text-ink tabular">{Math.min(100, Math.round((data.today.focusMinutes / data.today.goalMinutes) * 100))}%</span>
                </ProgressRing>
              ) : (
                <ProgressRing value={data.today.tasksDue ? data.today.tasksDueDone / data.today.tasksDue : data.today.tasksCompleted > 0 ? 1 : 0} size={96} stroke={10}>
                  <span className="text-xl font-extrabold text-ink tabular">
                    {data.today.tasksDueDone}/{data.today.tasksDue}
                  </span>
                </ProgressRing>
              )}
              <div className="flex-1 space-y-2.5">
                {stand ? (
                  <div>
                    <p className="text-xs text-muted">Study goal</p>
                    <p className="text-[17px] font-bold text-ink tabular">
                      {fmtMinutes(data.today.focusMinutes)} <span className="text-sm font-medium text-muted">/ {fmtMinutes(data.today.goalMinutes)}</span>
                    </p>
                  </div>
                ) : (
                  <div>
                    <p className="text-xs text-muted">Due today</p>
                    <p className="text-[17px] font-bold text-ink">{data.today.tasksDue ? `${data.today.tasksDueDone} of ${data.today.tasksDue} done` : "Nothing due today"}</p>
                  </div>
                )}
                <div className="flex gap-4">
                  <div>
                    <p className="text-xs text-muted">Completed</p>
                    <p className="font-bold text-ink tabular">{data.today.tasksCompleted}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted">Streak</p>
                    <p className="flex items-center gap-1 font-bold text-ink tabular">
                      <Flame className={cx("size-4", data.streak.current ? "text-orange-500" : "text-faint")} /> {data.streak.current}d
                    </p>
                  </div>
                  {stand && (
                    <div>
                      <p className="text-xs text-muted">Sessions</p>
                      <p className="font-bold text-ink tabular">{data.today.focusSessions}</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </Card>

          <nav className="mt-4 grid grid-cols-4 gap-2" aria-label="Quick actions">
            {quick.map(({ href, label, icon: Icon }) => (
              <Link key={label} href={href} className="flex flex-col items-center gap-1.5 rounded-2xl py-2 active:bg-white">
                <span className="grid size-14 place-items-center rounded-2xl border border-line bg-white text-brand-700 shadow-[var(--shadow-card)]">
                  <Icon className="size-6" />
                </span>
                <span className="text-xs font-medium text-ink-2">{label}</span>
              </Link>
            ))}
          </nav>

          {stand && data.checkin && (
            <Link href={me.access.features.moodHistory ? "/mood" : "/checkin"} className="mt-4 flex items-center gap-3 rounded-2xl border border-line bg-white px-4 py-3">
              <span className="grid size-10 place-items-center rounded-xl text-xl" style={{ background: moodOf(data.checkin.mood).bg }}>
                {moodOf(data.checkin.mood).emoji}
              </span>
              <div className="flex-1 text-sm">
                <p className="font-semibold text-ink">Checked in feeling {moodOf(data.checkin.mood).label.toLowerCase()}</p>
                <p className="text-xs text-muted">
                  {mindsetOf(data.checkin.mindset).label} · {fmtTime(data.checkin.at)}
                </p>
              </div>
            </Link>
          )}

          {data.recommendations.length > 0 && (
            <>
              <SectionTitle>For you</SectionTitle>
              <ul className="space-y-2">
                {data.recommendations.map((r) => (
                  <li key={r.id} className="flex items-start gap-3 rounded-2xl border border-brand-100 bg-brand-50/60 p-3.5">
                    <Lightbulb className="mt-0.5 size-5 shrink-0 text-brand-600" />
                    <p className="flex-1 text-sm text-ink-2">{r.text}</p>
                    {r.action && (
                      <Link href={r.action.href} className="shrink-0 rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-brand-700 shadow-sm">
                        {r.action.label}
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            </>
          )}

          <SectionTitle action={<Link href="/tasks" className="text-sm font-semibold text-brand-600">View all</Link>}>
            {data.dueToday.length ? "Today's Tasks" : "Upcoming deadlines"}
          </SectionTitle>
          {(data.dueToday.length ? data.dueToday : data.upcoming).length === 0 ? (
            <Card>
              <EmptyState
                icon={<ListChecks className="size-7" />}
                title="You're all caught up"
                body="No open tasks. Add your next assignment so you never miss a deadline."
                action={
                  <Link href="/tasks/new" className="inline-flex h-10 items-center gap-1.5 rounded-full bg-brand-700 px-4 text-sm font-semibold text-white">
                    <Plus className="size-4" /> Add task
                  </Link>
                }
              />
            </Card>
          ) : (
            <ul className="space-y-2.5">
              {(data.dueToday.length ? data.dueToday : data.upcoming).map((t) => (
                <TaskCard
                  key={t.id}
                  task={t}
                  onToggle={toggle}
                  showProgress={t.checklist.total > 0}
                  action={
                    stand && t.status !== "completed" ? (
                      <Link href={`/focus?task=${t.id}`} className="shrink-0 rounded-full border border-brand-200 px-3 py-1.5 text-xs font-semibold text-brand-700">
                        Start
                      </Link>
                    ) : undefined
                  }
                />
              ))}
            </ul>
          )}
          {data.overdueCount > 0 && (
            <Link href="/tasks?status=overdue" className="mt-3 block rounded-2xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
              {data.overdueCount} overdue task{data.overdueCount === 1 ? "" : "s"}. Review now →
            </Link>
          )}
        </>
      ) : null}

      <Link href="/tasks/new" aria-label="Add task" className="fixed right-5 bottom-24 z-20 grid size-14 place-items-center rounded-full bg-brand-700 text-white shadow-[var(--shadow-float)] active:scale-95">
        <Plus className="size-7" />
      </Link>
    </main>
  );
}
