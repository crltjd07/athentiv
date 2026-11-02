"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { useApi } from "@/lib/useApi";
import { useMe } from "@/lib/me";
import { fromDayKey, localDayKey, startOfDay } from "@/lib/format";
import { PageHeader } from "@/components/Nav";
import { TaskCard, type Task } from "@/components/TaskBits";
import { Card, EmptyState, ErrorState, Segmented, Spinner, cx } from "@/components/ui";

const WD = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function mondayOf(d: Date) {
  const x = startOfDay(d);
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7));
  return x;
}

export default function CalendarPage() {
  const { me } = useMe();
  const [mode, setMode] = useState<"week" | "month">("week");
  const [anchor, setAnchor] = useState(() => startOfDay(new Date()));
  const [selected, setSelected] = useState(() => localDayKey(new Date()));

  const range = useMemo(() => {
    if (mode === "week") {
      const from = mondayOf(anchor);
      const to = new Date(from);
      to.setDate(to.getDate() + 7);
      return { from, to };
    }
    const first = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
    const from = mondayOf(first);
    const last = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0);
    const to = mondayOf(last);
    to.setDate(to.getDate() + 7);
    return { from, to };
  }, [mode, anchor]);

  const { data, error, loading, reload } = useApi<{ items: Task[] }>(`/api/tasks?status=all&dueFrom=${range.from.getTime()}&dueTo=${range.to.getTime()}&limit=500`);
  const byDay = useMemo(() => {
    const m = new Map<string, Task[]>();
    for (const t of data?.items ?? []) {
      const k = localDayKey(t.dueAt);
      m.set(k, [...(m.get(k) ?? []), t]);
    }
    return m;
  }, [data]);

  const days: Date[] = [];
  for (let d = new Date(range.from); d < range.to; d.setDate(d.getDate() + 1)) days.push(new Date(d));
  const today = localDayKey(new Date());

  function shift(n: number) {
    const a = new Date(anchor);
    if (mode === "week") a.setDate(a.getDate() + 7 * n);
    else a.setMonth(a.getMonth() + n, 1);
    setAnchor(a);
  }

  const title =
    mode === "week"
      ? `${range.from.toLocaleDateString("en-PH", { month: "short", day: "numeric" })} – ${new Date(range.to.getTime() - 86_400_000).toLocaleDateString("en-PH", { month: "short", day: "numeric" })}`
      : anchor.toLocaleDateString("en-PH", { month: "long", year: "numeric" });

  const selectedTasks = byDay.get(selected) ?? [];

  return (
    <main className="mx-auto max-w-[480px] px-4">
      <PageHeader title="Calendar" back={me.access.standOwner ? true : undefined} />
      <Segmented options={[{ value: "week", label: "Week" }, { value: "month", label: "Month" }]} value={mode} onChange={setMode} />

      <div className="mt-4 flex items-center justify-between">
        <h2 className="text-[17px] font-bold text-ink">{title}</h2>
        <div className="flex items-center gap-1">
          {loading && <Spinner className="size-4" />}
          <button aria-label="Previous" onClick={() => shift(-1)} className="grid size-10 place-items-center rounded-full active:bg-black/5">
            <ChevronLeft className="size-5" />
          </button>
          <button onClick={() => { setAnchor(startOfDay(new Date())); setSelected(today); }} className="h-8 rounded-full px-3 text-xs font-semibold text-brand-700">
            Today
          </button>
          <button aria-label="Next" onClick={() => shift(1)} className="grid size-10 place-items-center rounded-full active:bg-black/5">
            <ChevronRight className="size-5" />
          </button>
        </div>
      </div>

      {error && <ErrorState message={error.message} onRetry={reload} />}

      {mode === "month" ? (
        <Card className="mt-3 p-3">
          <div className="grid grid-cols-7 text-center text-[11px] font-semibold text-muted">
            {WD.map((d) => <div key={d} className="py-1">{d}</div>)}
          </div>
          <div className="grid grid-cols-7 gap-y-1">
            {days.map((d) => {
              const k = localDayKey(d);
              const items = byDay.get(k) ?? [];
              const inMonth = d.getMonth() === anchor.getMonth();
              return (
                <button key={k} onClick={() => setSelected(k)} className="flex flex-col items-center gap-0.5 py-1">
                  <span className={cx("grid size-9 place-items-center rounded-full text-sm font-semibold tabular", k === selected ? "bg-brand-700 text-white" : k === today ? "bg-brand-50 text-brand-700" : inMonth ? "text-ink" : "text-faint")}>
                    {d.getDate()}
                  </span>
                  <span className="flex h-1.5 gap-0.5">
                    {items.slice(0, 3).map((t) => (
                      <span key={t.id} className="size-1.5 rounded-full" style={{ background: t.status === "completed" ? "#94A3B8" : t.status === "overdue" ? "#DC2626" : t.subject?.color ?? "#2F5BEA" }} />
                    ))}
                  </span>
                </button>
              );
            })}
          </div>
        </Card>
      ) : (
        <div className="mt-3 space-y-2">
          {days.map((d) => {
            const k = localDayKey(d);
            const items = byDay.get(k) ?? [];
            return (
              <div key={k} className="flex gap-3">
                <div className={cx("w-12 shrink-0 pt-2 text-center", k === today ? "text-brand-700" : "text-muted")}>
                  <div className="text-[11px] font-semibold">{WD[(d.getDay() + 6) % 7]}</div>
                  <div className="text-lg font-extrabold tabular">{d.getDate()}</div>
                </div>
                <div className="min-w-0 flex-1">
                  {items.length ? (
                    <ul className="space-y-2">{items.map((t) => <TaskCard key={t.id} task={t} />)}</ul>
                  ) : (
                    <div className="flex h-14 items-center rounded-[18px] border border-dashed border-line px-4 text-sm text-faint">No deadlines</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {mode === "month" && (
        <>
          <h3 className="mt-5 mb-2 px-1 font-bold text-ink">{fromDayKey(selected).toLocaleDateString("en-PH", { weekday: "long", month: "long", day: "numeric" })}</h3>
          {selectedTasks.length ? (
            <ul className="space-y-2">{selectedTasks.map((t) => <TaskCard key={t.id} task={t} />)}</ul>
          ) : (
            <EmptyState icon={<CalendarDays className="size-7" />} title="No deadlines this day" action={<Link href="/tasks/new" className="inline-flex h-10 items-center gap-1.5 rounded-full bg-brand-700 px-4 text-sm font-semibold text-white"><Plus className="size-4" /> Add task</Link>} />
          )}
        </>
      )}
    </main>
  );
}
