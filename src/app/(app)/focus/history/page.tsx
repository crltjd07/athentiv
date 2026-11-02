"use client";

import { Timer } from "lucide-react";
import { useApi } from "@/lib/useApi";
import { useMe } from "@/lib/me";
import { fmtDateTime } from "@/lib/format";
import { StatTile } from "@/components/Charts";
import { PageHeader } from "@/components/Nav";
import { LockedCard } from "@/components/Premium";
import { AccessDenied } from "@/components/SystemScreens";
import { Card, EmptyState, ErrorState, PageSkeleton, SectionTitle } from "@/components/ui";

type History = {
  items: { id: number; status: string; preset: string; plannedMinutes: number; focusedMinutes: number; startedAt: number; endReason: string | null; task: { id: number; title: string | null; subject: string | null; color: string | null } | null }[];
  limit: number;
  stats: null | { completedSessions: number; endedEarly: number; cancelled: number; totalFocusMinutes: number; averageMinutes: number; longestMinutes: number; completionRate: number | null };
};

const STATUS: Record<string, { label: string; cls: string }> = {
  completed: { label: "Completed", cls: "bg-green-50 text-green-700" },
  ended_early: { label: "Ended early", cls: "bg-amber-50 text-amber-700" },
  cancelled: { label: "Cancelled", cls: "bg-slate-100 text-slate-600" },
};

export default function FocusHistory() {
  const { me } = useMe();
  const { data, error, reload } = useApi<History>(me.access.standOwner ? "/api/pomodoro/history" : null);
  if (!me.access.standOwner) return <AccessDenied />;

  return (
    <main className="mx-auto max-w-[480px] px-4">
      <PageHeader title="Session History" back="/focus" subtitle={data ? `Last ${data.limit} sessions` : undefined} />
      {error ? (
        <ErrorState message={error.message} onRetry={reload} />
      ) : !data ? (
        <PageSkeleton />
      ) : (
        <>
          {data.stats ? (
            <div className="grid grid-cols-2 gap-2.5">
              <StatTile label="Completed sessions" value={data.stats.completedSessions} />
              <StatTile label="Total focus" value={`${data.stats.totalFocusMinutes}m`} />
              <StatTile label="Average session" value={`${data.stats.averageMinutes}m`} sub={`Longest ${data.stats.longestMinutes}m`} />
              <StatTile label="Completion rate" value={data.stats.completionRate === null ? "—" : `${data.stats.completionRate}%`} sub={`${data.stats.endedEarly} ended early · ${data.stats.cancelled} cancelled`} />
            </div>
          ) : (
            <LockedCard title="Detailed focus statistics" body="See completed-session counts, total focus minutes, averages and your last 20 sessions." feature="Focus statistics" />
          )}
          <SectionTitle>Recent sessions</SectionTitle>
          {data.items.length === 0 ? (
            <EmptyState icon={<Timer className="size-7" />} title="No sessions yet" body="Your completed focus sessions will appear here." />
          ) : (
            <Card className="divide-y divide-line">
              {data.items.map((s) => (
                <div key={s.id} className="flex items-center gap-3 px-4 py-3">
                  <span className="size-2.5 shrink-0 rounded-full" style={{ background: s.task?.color ?? "#94A3B8" }} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-ink">{s.task?.title ?? "General study"}</p>
                    <p className="text-xs text-muted">
                      {fmtDateTime(s.startedAt)} · {s.preset}
                      {s.endReason === "pause_timeout" && " · paused too long"}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-ink tabular">{s.status === "cancelled" ? "—" : `${s.focusedMinutes}m`}</p>
                    <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold ${STATUS[s.status]?.cls ?? ""}`}>{STATUS[s.status]?.label ?? s.status}</span>
                  </div>
                </div>
              ))}
            </Card>
          )}
        </>
      )}
    </main>
  );
}
