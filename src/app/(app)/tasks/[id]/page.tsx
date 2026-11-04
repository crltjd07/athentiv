"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { CalendarClock, Check, History, Pencil, Plus, Timer, Trash2, X } from "lucide-react";
import { api, ApiClientError } from "@/lib/api";
import { useApi } from "@/lib/useApi";
import { useMe } from "@/lib/me";
import { fmtDateTime, fmtDue, fmtRelative } from "@/lib/format";
import { effortOf } from "@/shared/catalog";
import { PageHeader } from "@/components/Nav";
import { LockedCard, useApiErrorHandler } from "@/components/Premium";
import { useConfirm } from "@/components/Sheet";
import { SubjectIcon } from "@/components/SubjectIcon";
import { EffortBadge, StatusBadge, TypeBadge, type Task } from "@/components/TaskBits";
import { useToast } from "@/components/Toast";
import { Button, ButtonLink, Card, ErrorState, PageSkeleton, ProgressBar, SectionTitle, cx } from "@/components/ui";
import { GenericDenied } from "@/components/SystemScreens";
import { DictateButton } from "@/components/DictateButton";

type Detail = {
  task: Task;
  checklist: { id: number; label: string; done: boolean }[];
  history: { from: string | null; to: string; source: string; at: number }[];
  focusSessions: { id: number; startedAt: number; minutes: number; status: string }[] | null;
};

const STATUS_OPTIONS = [
  { key: "pending", label: "Pending" },
  { key: "in_progress", label: "In progress" },
  { key: "completed", label: "Completed" },
] as const;

export default function TaskDetail() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { me } = useMe();
  const confirm = useConfirm();
  const toast = useToast();
  const onError = useApiErrorHandler();
  const { data, error, reload, setData } = useApi<Detail>(`/api/tasks/${id}`);
  const [newItem, setNewItem] = useState("");
  const [busy, setBusy] = useState(false);

  if (error?.status === 404) return <GenericDenied message="This task doesn't exist or belongs to another account." />;
  if (error) return <ErrorState message={error.message} onRetry={reload} />;
  if (!data) return <main className="mx-auto max-w-[480px] px-4"><PageHeader title="Task Details" back="/tasks" /><PageSkeleton /></main>;

  const t = data.task;
  const done = t.status === "completed";
  const pct = data.checklist.length ? Math.round((data.checklist.filter((c) => c.done).length / data.checklist.length) * 100) : done ? 100 : 0;

  async function setStatus(status: string) {
    setBusy(true);
    try {
      await api(`/api/tasks/${id}/status`, { body: { status } });
      if (status === "completed") toast("Task completed");
      await reload();
    } catch (e) {
      if (e instanceof ApiClientError && e.code === "TASK_LIMIT") onError(new ApiClientError(403, "PREMIUM_REQUIRED", e.message, {}, { feature: "Unlimited tasks" }));
      else onError(e);
    } finally {
      setBusy(false);
    }
  }

  async function addItem(e: React.FormEvent) {
    e.preventDefault();
    if (!newItem.trim()) return;
    try {
      const r = await api<{ item: Detail["checklist"][number] }>(`/api/tasks/${id}/checklist`, { body: { label: newItem.trim() } });
      setData({ ...data!, checklist: [...data!.checklist, r.item] });
      setNewItem("");
    } catch (e) {
      onError(e);
    }
  }

  async function toggleItem(itemId: number, isDone: boolean) {
    setData({ ...data!, checklist: data!.checklist.map((c) => (c.id === itemId ? { ...c, done: isDone } : c)) });
    try {
      await api(`/api/tasks/${id}/checklist/${itemId}`, { method: "PATCH", body: { done: isDone } });
    } catch (e) {
      onError(e);
      void reload();
    }
  }

  async function removeItem(itemId: number) {
    setData({ ...data!, checklist: data!.checklist.filter((c) => c.id !== itemId) });
    try {
      await api(`/api/tasks/${id}/checklist/${itemId}`, { method: "DELETE" });
    } catch (e) {
      onError(e);
      void reload();
    }
  }

  async function remove() {
    const ok = await confirm({ title: "Delete this task?", body: `"${t.title}" and its checklist will be permanently deleted. Focus time already recorded is kept as general study.`, confirmLabel: "Delete task", danger: true });
    if (!ok) return;
    try {
      await api(`/api/tasks/${id}`, { method: "DELETE" });
      toast("Task deleted");
      router.replace("/tasks");
    } catch (e) {
      onError(e);
    }
  }

  return (
    <main className="mx-auto max-w-[480px] px-4">
      <PageHeader
        title="Task Details"
        back="/tasks"
        action={
          <Link href={`/tasks/${id}/edit`} aria-label="Edit task" className="grid size-11 place-items-center rounded-full text-ink-2 active:bg-black/5">
            <Pencil className="size-5" />
          </Link>
        }
      />

      <div className="flex items-start gap-3.5 animate-fade-up">
        <SubjectIcon icon={t.subject?.icon} color={t.subject?.color} size={56} />
        <div className="min-w-0 flex-1">
          <h2 className={cx("text-xl font-extrabold leading-snug tracking-tight text-ink", done && "text-muted line-through decoration-slate-500 decoration-2")}>{t.title}</h2>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            <TypeBadge type={t.type} />
            <StatusBadge status={t.status} />
          </div>
        </div>
      </div>

      <Card className="mt-4 divide-y divide-line">
        <div className="flex items-center gap-3 px-4 py-3">
          <CalendarClock className="size-5 text-brand-600" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-ink">{fmtDue(t.dueAt)}</p>
            <p className={cx("text-xs", t.status === "overdue" ? "font-semibold text-red-600" : "text-muted")}>
              {done ? `Completed ${t.completedAt ? fmtDateTime(t.completedAt) : ""}` : t.status === "overdue" ? `Overdue by ${fmtRelative(t.dueAt).replace(" ago", "")}` : `Due ${fmtRelative(t.dueAt)}`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3 px-4 py-3">
          <EffortBadge effort={t.effort} />
          <p className="text-sm text-ink-2">
            Effort: <span className="font-semibold text-ink">{effortOf(t.effort).label}</span> ({effortOf(t.effort).hint})
          </p>
        </div>
        {t.subject && (
          <div className="flex items-center gap-3 px-4 py-3">
            <span className="size-5 rounded-md" style={{ background: t.subject.color }} />
            <p className="text-sm font-medium text-ink">{t.subject.name}</p>
          </div>
        )}
        {t.description && <p className="whitespace-pre-wrap px-4 py-3 text-sm text-ink-2">{t.description}</p>}
      </Card>

      <div className="mt-4 grid grid-cols-3 gap-1 rounded-full border border-line bg-white p-1" role="radiogroup" aria-label="Status">
        {STATUS_OPTIONS.map((s) => {
          const active = t.storedStatus === s.key;
          return (
            <button key={s.key} role="radio" aria-checked={active} disabled={busy} onClick={() => !active && setStatus(s.key)} className={cx("h-10 rounded-full text-sm font-semibold", active ? "bg-brand-700 text-white" : "text-ink-2")}>
              {s.label}
            </button>
          );
        })}
      </div>

      <SectionTitle action={<span className="text-sm font-bold text-brand-700">{pct}%</span>}>Progress</SectionTitle>
      <Card className="p-4">
        <ProgressBar value={pct} />
        <ul className="mt-3 divide-y divide-line">
          {data.checklist.map((c) => (
            <li key={c.id} className="flex items-center gap-3 py-2.5">
              <button aria-label={c.done ? "Mark not done" : "Mark done"} onClick={() => toggleItem(c.id, !c.done)} className={cx("grid size-6 shrink-0 place-items-center rounded-md border-2", c.done ? "border-brand-700 bg-brand-700 text-white" : "border-slate-300 text-transparent")}>
                <Check className="size-3.5" strokeWidth={3} />
              </button>
              <span className={cx("flex-1 text-sm", c.done ? "text-faint line-through" : "text-ink")}>{c.label}</span>
              <button aria-label="Remove item" onClick={() => removeItem(c.id)} className="grid size-8 place-items-center text-faint">
                <X className="size-4" />
              </button>
            </li>
          ))}
        </ul>
        <form onSubmit={addItem} className="mt-2 flex items-center gap-2">
          <input value={newItem} onChange={(e) => setNewItem(e.target.value)} maxLength={120} placeholder="Add a step, e.g. Review lecture notes" className="h-11 min-w-0 flex-1 rounded-xl border border-line bg-slate-50 px-3 outline-none focus:border-brand-500" />
          <DictateButton label="Speak a step" className="size-11 rounded-xl" onText={(t) => setNewItem(t.slice(0, 120))} />
          <button type="submit" aria-label="Add step" className="grid size-11 place-items-center rounded-xl bg-brand-50 text-brand-700">
            <Plus className="size-5" />
          </button>
        </form>
      </Card>

      {me.access.standOwner && (
        <>
          <SectionTitle>Focus on this task</SectionTitle>
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <span className="grid size-11 place-items-center rounded-xl bg-brand-50 text-brand-700">
                <Timer className="size-5" />
              </span>
              <div className="flex-1">
                <p className="text-2xl font-extrabold text-ink tabular">{t.focusMinutes} min</p>
                <p className="text-xs text-muted">total focus time on this task</p>
              </div>
              {!done && (
                <ButtonLink href={`/focus?task=${t.id}`} size="sm">
                  Focus
                </ButtonLink>
              )}
            </div>
            {data.focusSessions ? (
              data.focusSessions.length > 0 && (
                <ul className="mt-3 space-y-1.5 border-t border-line pt-3 text-sm">
                  {data.focusSessions.map((s) => (
                    <li key={s.id} className="flex justify-between text-ink-2">
                      <span>{fmtDateTime(s.startedAt)}</span>
                      <span className="font-semibold tabular">{s.minutes} min{s.status === "ended_early" ? " (ended early)" : ""}</span>
                    </li>
                  ))}
                </ul>
              )
            ) : (
              <LockedCard className="mt-3" title="Task focus history" body="See every session you spent on this task, with dates and durations." feature="Task focus insights" />
            )}
          </Card>
        </>
      )}

      {data.history.length > 0 && (
        <>
          <SectionTitle>Activity</SectionTitle>
          <Card className="p-4">
            <ul className="space-y-2 text-sm">
              {data.history.map((h, i) => (
                <li key={i} className="flex items-center gap-2 text-ink-2">
                  <History className="size-4 text-faint" />
                  <span className="flex-1">
                    {h.from ? `${label(h.from)} → ${label(h.to)}` : "Created"}
                    {h.source === "pomodoro" && <span className="text-xs text-muted"> (focus session)</span>}
                  </span>
                  <span className="text-xs text-muted">{fmtDateTime(h.at)}</span>
                </li>
              ))}
            </ul>
          </Card>
        </>
      )}

      <div className="mt-6 space-y-2.5">
        {!done ? (
          <Button full size="lg" loading={busy} onClick={() => setStatus("completed")} icon={<Check className="size-5" />}>
            Mark as complete
          </Button>
        ) : (
          <Button full size="lg" variant="secondary" loading={busy} onClick={() => setStatus("pending")}>
            Reopen task
          </Button>
        )}
        <Button full variant="ghost" className="text-red-600" icon={<Trash2 className="size-4" />} onClick={remove}>
          Delete task
        </Button>
      </div>
    </main>
  );
}

const label = (s: string) => ({ pending: "Pending", in_progress: "In progress", completed: "Completed" })[s] ?? s;
