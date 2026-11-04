"use client";

import { Check, Clock, Flag, Flame, Heart, Lock, Sunrise, Target, Timer, Trophy, type LucideIcon } from "lucide-react";
import { useApi } from "@/lib/useApi";
import { fmtDate } from "@/lib/format";
import { PageHeader } from "@/components/Nav";
import { Card, ErrorState, PageSkeleton, SectionTitle, cx } from "@/components/ui";

const ICONS: Record<string, LucideIcon> = { flag: Flag, check: Check, trophy: Trophy, sunrise: Sunrise, flame: Flame, timer: Timer, target: Target, clock: Clock, heart: Heart };

type Data = { streak: { current: number; best: number; activeToday: boolean }; items: { key: string; title: string; desc: string; icon: string; unlockedAt: number | null }[] };

export default function Achievements() {
  const { data, error, reload } = useApi<Data>("/api/achievements");
  return (
    <main className="mx-auto max-w-[480px] px-4">
      <PageHeader title="Achievements" back="/profile" />
      {error ? (
        <ErrorState message={error.message} onRetry={reload} />
      ) : !data ? (
        <PageSkeleton />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-2.5">
            <Card className="p-4 text-center">
              <Flame className={cx("mx-auto size-8", data.streak.current ? "text-orange-500" : "text-faint")} />
              <p className="mt-1 text-3xl font-extrabold text-ink tabular">{data.streak.current}</p>
              <p className="text-xs text-muted">day streak{data.streak.current && !data.streak.activeToday ? ". Study today to keep it going!" : ""}</p>
            </Card>
            <Card className="p-4 text-center">
              <Trophy className="mx-auto size-8 text-amber-500" />
              <p className="mt-1 text-3xl font-extrabold text-ink tabular">{data.streak.best}</p>
              <p className="text-xs text-muted">best streak</p>
            </Card>
          </div>
          <p className="mt-2 px-1 text-xs text-muted">A study day counts when you complete a task or record focus time.</p>
          <SectionTitle>
            Badges · {data.items.filter((i) => i.unlockedAt).length}/{data.items.length}
          </SectionTitle>
          <div className="grid grid-cols-2 gap-2.5">
            {data.items.map((a) => {
              const Icon = ICONS[a.icon] ?? Trophy;
              const on = !!a.unlockedAt;
              return (
                <Card key={a.key} className={cx("p-4", !on && "opacity-60")}>
                  <span className={cx("grid size-11 place-items-center rounded-2xl", on ? "bg-gradient-to-br from-amber-300 to-amber-500 text-white" : "bg-slate-100 text-faint")}>
                    {on ? <Icon className="size-5" /> : <Lock className="size-4" />}
                  </span>
                  <p className="mt-2 text-sm font-bold text-ink">{a.title}</p>
                  <p className="text-xs text-muted">{a.desc}</p>
                  {on && <p className="mt-1 text-[11px] font-semibold text-amber-600">Unlocked {fmtDate(a.unlockedAt!)}</p>}
                </Card>
              );
            })}
          </div>
        </>
      )}
    </main>
  );
}
