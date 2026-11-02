"use client";

import { useMemo } from "react";
import { HeartPulse } from "lucide-react";
import { useApi } from "@/lib/useApi";
import { useMe } from "@/lib/me";
import { fmtDateTime, fromDayKey } from "@/lib/format";
import { moodOf, mindsetOf } from "@/shared/catalog";
import { HBarList } from "@/components/Charts";
import { PageHeader } from "@/components/Nav";
import { LockedCard } from "@/components/Premium";
import { AccessDenied } from "@/components/SystemScreens";
import { Card, EmptyState, ErrorState, PageSkeleton, SectionTitle } from "@/components/ui";

type MoodData = {
  from: string;
  to: string;
  items: { id: number; mood: string; mindset: string; intensity: number | null; note: string | null; createdAt: number }[];
  insights: {
    total: number;
    distribution: { mood: string; label: string; emoji: string; color: string; count: number }[];
    daily: { day: string; score: number | null; mood: string | null }[];
    byMood: { mood: string; label: string; emoji: string; days: number; avgFocusMinutes: number | null }[];
  };
};

export default function MoodHistory() {
  const { me } = useMe();
  const allowed = me.access.features.moodHistory;
  const { data, error, reload } = useApi<MoodData>(allowed ? "/api/checkins?days=35" : null);

  const weeks = useMemo(() => {
    if (!data) return [];
    const days = data.insights.daily;
    const pad = (fromDayKey(days[0].day).getDay() + 6) % 7;
    const cells: (MoodData["insights"]["daily"][number] | null)[] = [...Array(pad).fill(null), ...days];
    const out = [];
    for (let i = 0; i < cells.length; i += 7) out.push(cells.slice(i, i + 7));
    return out;
  }, [data]);

  if (!me.access.standOwner) return <AccessDenied />;

  return (
    <main className="mx-auto max-w-[480px] px-4">
      <PageHeader title="Mood History" back />
      {!allowed ? (
        <LockedCard title="Mood history is a Premium feature" body="Premium stand owners can see their check-in history, a mood calendar, mood distribution and how mood relates to focus time." feature="Mood history" />
      ) : error ? (
        <ErrorState message={error.message} onRetry={reload} />
      ) : !data ? (
        <PageSkeleton />
      ) : data.insights.total === 0 && data.items.length === 0 ? (
        <EmptyState icon={<HeartPulse className="size-7" />} title="No check-ins yet" body="Check in after tapping your stand. Your mood history will build up here." />
      ) : (
        <>
          <Card className="p-4">
            <h2 className="font-bold text-ink">Last 5 weeks</h2>
            <div className="mt-3 grid grid-cols-7 gap-1.5 text-center text-[10px] font-semibold text-muted">
              {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => <span key={i}>{d}</span>)}
            </div>
            <div className="mt-1 space-y-1.5">
              {weeks.map((w, i) => (
                <div key={i} className="grid grid-cols-7 gap-1.5">
                  {w.map((c, j) =>
                    c ? (
                      <div key={c.day} title={c.day} className="grid aspect-square place-items-center rounded-lg text-base" style={{ background: c.mood ? moodOf(c.mood).bg : "#F1F5F9" }}>
                        {c.mood ? moodOf(c.mood).emoji : <span className="text-[10px] text-faint">{Number(c.day.slice(8))}</span>}
                      </div>
                    ) : (
                      <div key={`p${j}`} />
                    ),
                  )}
                </div>
              ))}
            </div>
          </Card>

          <SectionTitle>Mood distribution</SectionTitle>
          <Card className="p-4">
            <HBarList items={data.insights.distribution.filter((d) => d.count > 0).map((d) => ({ label: `${d.emoji} ${d.label}`, value: d.count, color: d.color }))} total={data.insights.total} />
          </Card>

          {data.insights.byMood.length > 0 && (
            <>
              <SectionTitle>Mood &amp; focus</SectionTitle>
              <Card className="p-4">
                <p className="mb-3 text-xs text-muted">Average focus minutes on days you checked in with each mood.</p>
                <HBarList items={data.insights.byMood.map((m) => ({ label: `${m.emoji} ${m.label}`, value: m.avgFocusMinutes ?? 0, color: moodOf(m.mood).color, sub: `${m.days}d` }))} unit="m" />
                <p className="mt-3 text-[11px] text-faint">Self-reported mood for reflection only — not a medical or psychological assessment.</p>
              </Card>
            </>
          )}

          <SectionTitle>Recent check-ins</SectionTitle>
          <Card className="divide-y divide-line">
            {data.items.slice(0, 30).map((c) => (
              <div key={c.id} className="flex items-start gap-3 px-4 py-3">
                <span className="grid size-10 shrink-0 place-items-center rounded-xl text-xl" style={{ background: moodOf(c.mood).bg }}>
                  {moodOf(c.mood).emoji}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-ink">
                    {moodOf(c.mood).label}
                    {c.intensity && <span className="font-normal text-muted"> · intensity {c.intensity}/5</span>}
                  </p>
                  <p className="text-xs text-muted">
                    {mindsetOf(c.mindset).label} · {fmtDateTime(c.createdAt)}
                  </p>
                  {c.note && <p className="mt-1 text-sm text-ink-2">{c.note}</p>}
                </div>
              </div>
            ))}
          </Card>
        </>
      )}
    </main>
  );
}
