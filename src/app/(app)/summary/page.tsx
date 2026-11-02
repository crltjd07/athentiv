"use client";

import Link from "next/link";
import { useState } from "react";
import { CircleCheck, Clock, Download, Flame, Hourglass, Lightbulb, Target, TrendingDown, TrendingUp, TriangleAlert } from "lucide-react";
import { useApi } from "@/lib/useApi";
import { useMe } from "@/lib/me";
import { fmtMinutes, fromDayKey } from "@/lib/format";
import { BarChart, Donut, HBarList, StatTile } from "@/components/Charts";
import { LockedCard, LockIcon, useUpgrade } from "@/components/Premium";
import { TaskCard, type Task } from "@/components/TaskBits";
import { Card, ErrorState, Input, PageSkeleton, SectionTitle, Segmented, Spinner, cx } from "@/components/ui";
import { localDayKey } from "@/lib/format";

type Summary = {
  tier: "basic" | "advanced";
  range: { from: string; to: string; label: string; days: number };
  goalMinutes: number;
  overview: { focusMinutes: number; focusSessions: number; tasksCompleted: number; tasksCreated: number; pendingTasks: number; overdueTasks: number; dueInRange: number; completionRate: number | null; missedDeadlines: number; goalDays: number };
  daily: { day: string; focusMinutes: number; focusSessions: number; tasksCompleted: number }[];
  bestDay: { day: string; weekday: string; focusMinutes: number; tasksCompleted: number } | null;
  upcoming: Task[];
  streak: { current: number; best: number };
  previous: null | { from: string; to: string; overview: { focusMinutes: number; focusSessions: number; tasksCompleted: number; completionRate: number | null } };
  subjectFocus: { subjectId: number | null; name: string; color: string; minutes: number }[];
  subjectProgress: { subjectId: number | null; name: string; color: string; total: number; completed: number; open: number; overdue: number }[];
  typeDistribution: { type: string; label: string; count: number }[];
  mood: null | { total: number; distribution: { mood: string; label: string; emoji: string; color: string; count: number }[]; byMood: { mood: string; label: string; emoji: string; days: number; avgFocusMinutes: number | null }[] };
  insights: string[];
};

const TYPE_COLORS = ["#1539B0", "#2F5BEA", "#5B7FF2", "#8EA9FB", "#16A34A", "#94A3B8"];

export default function SummaryPage() {
  const { me } = useMe();
  const upgrade = useUpgrade();
  const advanced = me.access.features.advancedSummary;
  const stand = me.access.standOwner;
  const [range, setRange] = useState<"week" | "month" | "custom">("week");
  const today = localDayKey(new Date());
  const [from, setFrom] = useState(localDayKey(Date.now() - 29 * 86_400_000));
  const [to, setTo] = useState(today);
  const url = range === "custom" ? `/api/summary?range=custom&from=${from}&to=${to}` : `/api/summary?range=${range}`;
  const { data, error, loading, reload } = useApi<Summary>(url);

  const o = data?.overview;
  const metric = stand ? "focusMinutes" : "tasksCompleted";
  const dayLabel = (d: string) => (data && data.range.days <= 7 ? fromDayKey(d).toLocaleDateString("en-PH", { weekday: "narrow" }) : String(Number(d.slice(8))));

  return (
    <main className="mx-auto max-w-[480px] px-4 pt-safe">
      <header className="flex items-center justify-between pt-4">
        <h1 className="text-[26px] font-extrabold tracking-tight text-ink">Summary</h1>
        <div className="flex items-center gap-1">
          {loading && <Spinner className="size-4" />}
          {advanced ? (
            <Link href="/summary/export" className="inline-flex h-9 items-center gap-1.5 rounded-full bg-white px-3.5 text-sm font-semibold text-brand-700 shadow-[var(--shadow-card)]">
              <Download className="size-4" /> Export
            </Link>
          ) : (
            <button onClick={() => upgrade("Data exports")} className="inline-flex h-9 items-center gap-1.5 rounded-full bg-white px-3.5 text-sm font-semibold text-faint shadow-[var(--shadow-card)]">
              <Download className="size-4" /> Export <LockIcon />
            </button>
          )}
        </div>
      </header>

      <Segmented
        className="mt-3"
        value={range}
        onChange={(v) => (v !== "week" && !advanced ? upgrade("Monthly and custom reports") : setRange(v))}
        options={[
          { value: "week", label: "This week" },
          { value: "month", label: <>Month {!advanced && <LockIcon className="size-4" />}</> },
          { value: "custom", label: <>Custom {!advanced && <LockIcon className="size-4" />}</> },
        ]}
      />
      {range === "custom" && (
        <div className="mt-2 grid grid-cols-2 gap-2">
          <Input type="date" aria-label="From" value={from} max={to} onChange={(e) => setFrom(e.target.value)} />
          <Input type="date" aria-label="To" value={to} min={from} max={today} onChange={(e) => setTo(e.target.value)} />
        </div>
      )}

      {error ? (
        <ErrorState message={error.message} onRetry={reload} />
      ) : !data || !o ? (
        <PageSkeleton />
      ) : (
        <div className={cx("transition-opacity", loading && "opacity-60")}>
          <p className="mt-3 px-1 text-xs text-muted">
            {fromDayKey(data.range.from).toLocaleDateString("en-PH", { month: "short", day: "numeric" })} – {fromDayKey(data.range.to).toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" })}
          </p>
          <div className="mt-2 grid grid-cols-2 gap-2.5">
            {stand && <StatTile label="Focus time" value={fmtMinutes(o.focusMinutes)} icon={<Clock className="size-4" />} sub={<Delta cur={o.focusMinutes} prev={data.previous?.overview.focusMinutes} />} />}
            {stand && <StatTile label="Focus sessions" value={o.focusSessions} icon={<Target className="size-4" />} sub={<Delta cur={o.focusSessions} prev={data.previous?.overview.focusSessions} />} />}
            <StatTile label="Tasks completed" value={o.tasksCompleted} icon={<CircleCheck className="size-4" />} tone="green" sub={<Delta cur={o.tasksCompleted} prev={data.previous?.overview.tasksCompleted} />} />
            <StatTile label="Completion rate" value={o.completionRate === null ? "—" : `${o.completionRate}%`} icon={<TrendingUp className="size-4" />} sub={o.dueInRange ? `${o.dueInRange} due in range` : "No deadlines in range"} />
            <StatTile label="Pending" value={o.pendingTasks} icon={<Hourglass className="size-4" />} tone="amber" sub="open, not yet due" />
            <StatTile label="Overdue" value={o.overdueTasks} icon={<TriangleAlert className="size-4" />} tone="red" sub={o.missedDeadlines ? `${o.missedDeadlines} missed in range` : "right now"} />
          </div>

          <Card className="mt-3 p-4">
            <div className="flex items-baseline justify-between">
              <h2 className="font-bold text-ink">{stand ? "Daily focus (min)" : "Tasks completed per day"}</h2>
              <span className="flex items-center gap-1 text-xs font-semibold text-orange-600">
                <Flame className="size-3.5" /> {data.streak.current}-day streak
              </span>
            </div>
            <div className="mt-4">
              <BarChart
                data={data.daily.map((d) => ({ key: d.day, label: dayLabel(d.day), value: d[metric] }))}
                highlight={data.bestDay?.day}
                goal={stand ? data.goalMinutes : undefined}
                unit={stand ? " min" : ""}
              />
            </div>
            {data.bestDay && <p className="mt-3 text-xs text-muted">Most productive: <span className="font-semibold text-ink">{data.bestDay.weekday}</span></p>}
          </Card>

          {data.insights.length > 0 && (
            <>
              <SectionTitle>Insights</SectionTitle>
              <Card className="space-y-2.5 p-4">
                {data.insights.map((i) => (
                  <p key={i} className="flex gap-2.5 text-sm text-ink-2">
                    <Lightbulb className="mt-0.5 size-4 shrink-0 text-brand-600" /> {i}
                  </p>
                ))}
              </Card>
            </>
          )}

          {advanced ? (
            <>
              {stand && data.subjectFocus.length > 0 && (
                <>
                  <SectionTitle>Focus by subject</SectionTitle>
                  <Card className="p-4">
                    <HBarList items={data.subjectFocus.map((s) => ({ label: s.name, value: s.minutes, color: s.color }))} unit="m" />
                  </Card>
                </>
              )}
              {data.subjectProgress.length > 0 && (
                <>
                  <SectionTitle>Progress by subject</SectionTitle>
                  <Card className="divide-y divide-line">
                    {data.subjectProgress.map((s) => (
                      <div key={s.name} className="px-4 py-3">
                        <div className="flex items-center justify-between text-sm">
                          <span className="flex items-center gap-2 font-semibold text-ink"><span className="size-2.5 rounded-full" style={{ background: s.color }} />{s.name}</span>
                          <span className="text-muted tabular">{s.completed}/{s.total}{s.overdue ? <span className="text-red-600"> · {s.overdue} overdue</span> : null}</span>
                        </div>
                        <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-slate-100">
                          <div className="h-full rounded-full" style={{ width: `${(s.completed / Math.max(1, s.total)) * 100}%`, background: s.color }} />
                        </div>
                      </div>
                    ))}
                  </Card>
                </>
              )}
              {data.typeDistribution.length > 0 && (
                <>
                  <SectionTitle>Task types</SectionTitle>
                  <Card className="flex items-center gap-5 p-4">
                    <Donut
                      segments={data.typeDistribution.map((t, i) => ({ label: t.label, value: t.count, color: TYPE_COLORS[i % TYPE_COLORS.length] }))}
                      center={<div><div className="text-xl font-extrabold text-ink">{data.typeDistribution.reduce((a, t) => a + t.count, 0)}</div><div className="text-[10px] text-muted">tasks due</div></div>}
                    />
                    <ul className="flex-1 space-y-1.5 text-sm">
                      {data.typeDistribution.map((t, i) => (
                        <li key={t.type} className="flex items-center gap-2">
                          <span className="size-2.5 rounded-full" style={{ background: TYPE_COLORS[i % TYPE_COLORS.length] }} />
                          <span className="flex-1 text-ink-2">{t.label}</span>
                          <span className="font-semibold text-ink tabular">{t.count}</span>
                        </li>
                      ))}
                    </ul>
                  </Card>
                </>
              )}
              {stand && (
                <>
                  <SectionTitle>Mood insights</SectionTitle>
                  {data.mood && data.mood.total > 0 ? (
                    <Card className="p-4">
                      <div className="flex flex-wrap gap-2">
                        {data.mood.distribution.filter((m) => m.count).map((m) => (
                          <span key={m.mood} className="inline-flex items-center gap-1 rounded-full bg-slate-50 px-3 py-1.5 text-sm font-medium text-ink-2">
                            {m.emoji} {m.label} <span className="font-bold text-ink">{m.count}</span>
                          </span>
                        ))}
                      </div>
                      <Link href="/mood" className="mt-3 inline-block text-sm font-semibold text-brand-700">Open mood history →</Link>
                    </Card>
                  ) : (
                    <Card className="p-4 text-sm text-muted">No check-ins in this period.</Card>
                  )}
                </>
              )}
            </>
          ) : (
            <LockedCard
              className="mt-5"
              title="Unlock detailed analytics"
              body={`Monthly and custom reports, comparisons with previous periods, subject breakdowns${stand ? ", mood insights" : ""} and downloadable reports.`}
              feature="Detailed analytics"
            />
          )}

          {data.upcoming.length > 0 && (
            <>
              <SectionTitle action={<Link href="/tasks" className="text-sm font-semibold text-brand-600">All tasks</Link>}>Upcoming deadlines</SectionTitle>
              <ul className="space-y-2.5">{data.upcoming.map((t) => <TaskCard key={t.id} task={t} />)}</ul>
            </>
          )}
        </div>
      )}
    </main>
  );
}

function Delta({ cur, prev }: { cur: number; prev?: number }) {
  if (prev === undefined) return null;
  if (prev === cur) return <span className="text-muted">same as before</span>;
  const up = cur > prev;
  return (
    <span className={cx("inline-flex items-center gap-0.5 font-semibold", up ? "text-green-600" : "text-red-500")}>
      {up ? <TrendingUp className="size-3" /> : <TrendingDown className="size-3" />} {up ? "+" : ""}
      {cur - prev} vs previous
    </span>
  );
}
