"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";
import { ArrowUpDown, BookMarked, ListChecks, Plus, Search, SlidersHorizontal } from "lucide-react";
import { api } from "@/lib/api";
import { useApi } from "@/lib/useApi";
import { useMe } from "@/lib/me";
import { EFFORTS, TASK_TYPES } from "@/shared/catalog";
import { TaskCard, type Task } from "@/components/TaskBits";
import { LockIcon, useApiErrorHandler, useUpgrade } from "@/components/Premium";
import { Sheet } from "@/components/Sheet";
import type { Subject } from "@/components/Subjects";
import { useToast } from "@/components/Toast";
import { Button, Chip, EmptyState, ErrorState, Input, Label, PageSkeleton, ProgressBar, cx } from "@/components/ui";

type List = { items: Task[]; openCount: number; maxOpen: number | null };
const STATUS = [
  { key: "open", label: "Open" },
  { key: "all", label: "All" },
  { key: "pending", label: "Pending" },
  { key: "in_progress", label: "In progress" },
  { key: "overdue", label: "Overdue" },
  { key: "completed", label: "Completed" },
] as const;
const SORTS = [
  { key: "due", label: "Due date (soonest)", premium: false },
  { key: "due_desc", label: "Due date (latest)", premium: false },
  { key: "created", label: "Recently added", premium: false },
  { key: "effort", label: "Effort (largest first)", premium: true },
  { key: "subject", label: "Subject (A–Z)", premium: true },
] as const;

function TasksPage() {
  const { me } = useMe();
  const params = useSearchParams();
  const router = useRouter();
  const premium = me.access.features.advancedTaskFilters;
  const upgrade = useUpgrade();
  const onError = useApiErrorHandler();
  const toast = useToast();

  const [status, setStatus] = useState<string>(params.get("status") ?? "open");
  const [type, setType] = useState<string | null>(null);
  const [subject, setSubject] = useState<number | null>(null);
  const [effort, setEffort] = useState<string | null>(null);
  const [sort, setSort] = useState<string>("due");
  const [q, setQ] = useState("");
  const [debounced, setDebounced] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(q.trim()), 250);
    return () => clearTimeout(t);
  }, [q]);

  const url = useMemo(() => {
    const p = new URLSearchParams({ status, sort });
    if (type) p.set("type", type);
    if (premium && subject !== null) p.set("subject", String(subject));
    if (premium && effort) p.set("effort", effort);
    if (debounced) p.set("q", debounced);
    return `/api/tasks?${p}`;
  }, [status, sort, type, subject, effort, debounced, premium]);

  const { data, error, loading, reload } = useApi<List>(url);
  const subjects = useApi<{ items: Subject[] }>(premium ? "/api/subjects" : null).data?.items ?? [];
  const activeFilters = (type ? 1 : 0) + (subject !== null ? 1 : 0) + (effort ? 1 : 0) + (sort !== "due" ? 1 : 0);

  async function toggle(t: Task) {
    try {
      await api(`/api/tasks/${t.id}/status`, { body: { status: t.status === "completed" ? "pending" : "completed" } });
      if (t.status !== "completed") toast("Task completed! 🎉");
      await reload();
    } catch (e) {
      onError(e);
    }
  }

  const atLimit = data?.maxOpen != null && data.openCount >= data.maxOpen;

  return (
    <main className="mx-auto max-w-[480px] px-4 pt-safe">
      <header className="flex items-center justify-between pt-4">
        <h1 className="text-[26px] font-extrabold tracking-tight text-ink">Tasks</h1>
        <div className="flex gap-1">
          <Link href="/subjects" aria-label="Manage subjects" className="grid size-11 place-items-center rounded-full text-ink-2 active:bg-black/5">
            <BookMarked className="size-5" />
          </Link>
          <button aria-label="Filter and sort" onClick={() => setFiltersOpen(true)} className="relative grid size-11 place-items-center rounded-full text-ink-2 active:bg-black/5">
            <SlidersHorizontal className="size-5" />
            {activeFilters > 0 && <span className="absolute top-1.5 right-1.5 grid size-4 place-items-center rounded-full bg-brand-700 text-[10px] font-bold text-white">{activeFilters}</span>}
          </button>
        </div>
      </header>

      {data?.maxOpen != null && (
        <div className="mt-2 rounded-2xl border border-line bg-white p-3.5">
          <div className="flex items-center justify-between text-sm">
            <span className="font-semibold text-ink">
              {data.openCount} of {data.maxOpen} open tasks
            </span>
            <button onClick={() => upgrade("Unlimited tasks")} className="text-xs font-semibold text-brand-700">
              Go unlimited
            </button>
          </div>
          <ProgressBar value={(data.openCount / data.maxOpen) * 100} className="mt-2" color={atLimit ? "#DC2626" : undefined} />
          {atLimit && <p className="mt-2 text-xs text-muted">Complete or delete an open task to free a slot. Completed tasks stay in your history.</p>}
        </div>
      )}

      <div className="mt-3">
        <Input leading={<Search className="size-4 text-faint" />} placeholder="Search tasks" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      <div className="-mx-4 mt-3 flex gap-2 overflow-x-auto px-4 pb-1 no-scrollbar">
        {STATUS.map((s) => (
          <Chip key={s.key} selected={status === s.key} onClick={() => setStatus(s.key)}>
            {s.label}
          </Chip>
        ))}
      </div>

      <div className="mt-3">
        {loading && !data ? (
          <PageSkeleton />
        ) : error ? (
          <ErrorState message={error.message} onRetry={reload} />
        ) : data && data.items.length === 0 ? (
          <EmptyState
            icon={<ListChecks className="size-7" />}
            title={debounced || activeFilters ? "No matching tasks" : status === "completed" ? "Nothing completed yet" : "No tasks here"}
            body={debounced || activeFilters ? "Try a different search or clear your filters." : "Tap + to add an assignment, quiz, project or exam."}
          />
        ) : (
          <ul className={cx("space-y-2.5", loading && "opacity-60")}>
            {data?.items.map((t) => <TaskCard key={t.id} task={t} onToggle={toggle} />)}
          </ul>
        )}
      </div>

      <button
        aria-label="Add task"
        onClick={() => (atLimit ? upgrade("Unlimited tasks") : router.push("/tasks/new"))}
        className="fixed right-5 bottom-24 z-20 grid size-14 place-items-center rounded-full bg-brand-700 text-white shadow-[var(--shadow-float)] active:scale-95"
      >
        <Plus className="size-7" />
      </button>

      <Sheet open={filtersOpen} onClose={() => setFiltersOpen(false)} title="Filter & sort">
        <div className="space-y-5">
          <div>
            <Label>Task type</Label>
            <div className="flex flex-wrap gap-2">
              <Chip selected={!type} onClick={() => setType(null)}>Any</Chip>
              {TASK_TYPES.map((t) => (
                <Chip key={t.key} selected={type === t.key} onClick={() => setType(t.key)}>{t.label}</Chip>
              ))}
            </div>
          </div>
          <div>
            <Label hint={!premium && <span className="inline-flex items-center gap-1"><LockIcon /> Premium</span>}>Subject</Label>
            <div className="flex flex-wrap gap-2">
              <Chip selected={subject === null} onClick={() => setSubject(null)}>Any</Chip>
              {premium ? (
                <>
                  {subjects.map((s) => (
                    <Chip key={s.id} selected={subject === s.id} onClick={() => setSubject(s.id)}>
                      <span className="size-2 rounded-full" style={{ background: s.color }} /> {s.name}
                    </Chip>
                  ))}
                  <Chip selected={subject === 0} onClick={() => setSubject(0)}>No subject</Chip>
                </>
              ) : (
                <Chip locked onClick={() => upgrade("Filtering by subject")}>Choose subject…</Chip>
              )}
            </div>
          </div>
          <div>
            <Label hint={!premium && <span className="inline-flex items-center gap-1"><LockIcon /> Premium</span>}>Effort</Label>
            <div className="flex flex-wrap gap-2">
              <Chip selected={!effort} onClick={() => setEffort(null)}>Any</Chip>
              {EFFORTS.map((e) => (
                <Chip key={e.key} locked={!premium} selected={effort === e.key} onClick={() => (premium ? setEffort(e.key) : upgrade("Filtering by effort"))}>
                  {e.label}
                </Chip>
              ))}
            </div>
          </div>
          <div>
            <Label>Sort by</Label>
            <ul className="divide-y divide-line rounded-2xl border border-line">
              {SORTS.map((s) => (
                <li key={s.key}>
                  <button
                    onClick={() => (s.premium && !premium ? upgrade("Advanced sorting") : setSort(s.key))}
                    className="flex h-12 w-full items-center gap-3 px-4 text-left text-[15px]"
                  >
                    <ArrowUpDown className="size-4 text-faint" />
                    <span className={cx("flex-1", s.premium && !premium ? "text-faint" : "text-ink")}>{s.label}</span>
                    {s.premium && !premium && <LockIcon />}
                    {sort === s.key && <span className="size-2.5 rounded-full bg-brand-700" />}
                  </button>
                </li>
              ))}
            </ul>
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" className="flex-1" onClick={() => { setType(null); setSubject(null); setEffort(null); setSort("due"); }}>
              Reset
            </Button>
            <Button className="flex-1" onClick={() => setFiltersOpen(false)}>
              Show tasks
            </Button>
          </div>
        </div>
      </Sheet>
    </main>
  );
}

export default function Page() {
  return (
    <Suspense>
      <TasksPage />
    </Suspense>
  );
}
