"use client";

import Link from "next/link";
import { useState } from "react";
import { Check, Clock, ListChecks, Timer } from "lucide-react";
import type { TaskDTO } from "@/server/tasks";
import { effortOf, taskTypeLabel } from "@/shared/catalog";
import { fmtDue, fmtRelative } from "@/lib/format";
import { ProgressRing } from "./ProgressRing";
import { SubjectIcon } from "./SubjectIcon";
import { cx } from "./ui";

export type Task = TaskDTO;

export function EffortBadge({ effort, withLabel }: { effort: string; withLabel?: boolean }) {
  const e = effortOf(effort);
  return (
    <span className="inline-flex h-6 shrink-0 items-center justify-center rounded-lg px-2 text-[11px] font-bold" style={{ color: e.color, background: e.bg }} title={`${e.label} effort (${e.hint})`}>
      {e.label}
      {withLabel && <span className="ml-1 font-medium">· {e.hint}</span>}
    </span>
  );
}

const STATUS_STYLE: Record<string, { label: string; color: string; bg: string }> = {
  pending: { label: "Pending", color: "#475569", bg: "#F1F5F9" },
  in_progress: { label: "In progress", color: "#1539B0", bg: "#EEF3FF" },
  completed: { label: "Completed", color: "#15803D", bg: "#DCFCE7" },
  overdue: { label: "Overdue", color: "#B91C1C", bg: "#FEE2E2" },
};

export function StatusBadge({ status }: { status: string }) {
  const s = STATUS_STYLE[status] ?? STATUS_STYLE.pending;
  return (
    <span className="inline-flex h-6 items-center rounded-full px-2.5 text-xs font-semibold" style={{ color: s.color, background: s.bg }}>
      {s.label}
    </span>
  );
}

export function TypeBadge({ type }: { type: string }) {
  return <span className="inline-flex h-6 items-center rounded-full bg-brand-50 px-2.5 text-xs font-semibold text-brand-700">{taskTypeLabel(type)}</span>;
}

export function PriorityDot({ priority }: { priority: Task["priority"] }) {
  if (!priority || priority === "low") return null;
  return <span className={cx("inline-block size-2 rounded-full", priority === "high" ? "bg-red-500" : "bg-amber-400")} title={`${priority} priority`} />;
}

/** Task row: subject tile, title, meta, effort, quick-complete checkbox. */
export function TaskCard({ task, onToggle, showProgress, action }: { task: Task; onToggle?: (t: Task) => Promise<void> | void; showProgress?: boolean; action?: React.ReactNode }) {
  const [busy, setBusy] = useState(false);
  const [justDone, setJustDone] = useState(false);
  const done = task.status === "completed";
  const overdue = task.status === "overdue";
  const pct = task.checklist.total ? task.checklist.done / task.checklist.total : done ? 1 : 0;

  return (
    <li className={cx("flex items-center gap-3 rounded-[18px] border p-3 shadow-[var(--shadow-card)] transition-colors", done ? "border-green-100 bg-green-50/60" : "border-line bg-white")}>
      <Link href={`/tasks/${task.id}`} className="flex min-w-0 flex-1 items-center gap-3">
        <SubjectIcon icon={task.subject?.icon} color={task.subject?.color} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <PriorityDot priority={task.priority} />
            <p className={cx("truncate text-[15px] font-semibold", done ? "text-muted line-through decoration-slate-500 decoration-2" : "text-ink")}>{task.title}</p>
          </div>
          <p className={cx("mt-0.5 flex items-center gap-1 truncate text-xs", overdue ? "font-semibold text-red-600" : done ? "font-semibold text-green-700" : "text-muted")}>
            <span>{taskTypeLabel(task.type)}</span>
            <span>·</span>
            <Clock className="size-3 shrink-0" />
            <span className="truncate">{done ? "Completed" : overdue ? `Overdue · ${fmtRelative(task.dueAt)}` : fmtDue(task.dueAt)}</span>
          </p>
          {(task.subject || task.checklist.total > 0 || task.focusMinutes > 0) && (
            <p className="mt-1 flex items-center gap-2 text-[11px] text-faint">
              {task.subject && <span className="truncate font-medium" style={{ color: task.subject.color }}>{task.subject.name}</span>}
              {task.checklist.total > 0 && (
                <span className="inline-flex items-center gap-0.5">
                  <ListChecks className="size-3" /> {task.checklist.done}/{task.checklist.total}
                </span>
              )}
              {task.focusMinutes > 0 && (
                <span className="inline-flex items-center gap-0.5">
                  <Timer className="size-3" /> {task.focusMinutes}m
                </span>
              )}
            </p>
          )}
        </div>
        {showProgress ? (
          <ProgressRing value={pct} size={40} stroke={4.5} color={done ? "#16A34A" : "#1F48D4"}>
            <span className="text-[10px] font-bold text-ink-2">{Math.round(pct * 100)}%</span>
          </ProgressRing>
        ) : (
          <EffortBadge effort={task.effort} />
        )}
      </Link>
      {action}
      {onToggle && (
        <button
          aria-label={done ? `Mark ${task.title} as not done` : `Mark ${task.title} as done`}
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            if (!done) setJustDone(true);
            try {
              await onToggle(task);
            } finally {
              setBusy(false);
              setTimeout(() => setJustDone(false), 600);
            }
          }}
          className={cx(
            "grid size-8 shrink-0 place-items-center rounded-full border-2 transition-colors",
            done || justDone ? "border-green-500 bg-green-500 text-white" : "border-slate-300 text-transparent",
            justDone && "animate-pop",
          )}
        >
          <Check className="size-4" strokeWidth={3} />
        </button>
      )}
    </li>
  );
}
