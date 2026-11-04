"use client";

import { useState } from "react";
import { CalendarDays, ChevronRight, Mic } from "lucide-react";
import { useApi } from "@/lib/useApi";
import { fmtDateLong, localDayKey, presetDate } from "@/lib/format";
import { EFFORTS, TASK_TYPES, type Effort, type TaskType } from "@/shared/catalog";
import type { ParsedTask } from "@/shared/taskParser";
import { SubjectPicker, type Subject } from "./Subjects";
import { SubjectIcon } from "./SubjectIcon";
import { VoiceTaskSheet } from "./VoiceTaskSheet";
import { Button, Chip, Input, Label, Textarea, cx } from "./ui";
import { DictateButton } from "./DictateButton";

export type TaskFormValues = { title: string; type: TaskType; subjectId: number | null; dueAt: number; effort: Effort; description: string | null };

const PRESETS = [
  { key: "today", label: "Today" },
  { key: "tomorrow", label: "Tomorrow" },
  { key: "this_week", label: "This week" },
  { key: "next_week", label: "Next week" },
] as const;

export function TaskForm({
  initial,
  submitLabel,
  onSubmit,
  saving,
  fieldErrors,
  voice,
}: {
  initial?: Partial<TaskFormValues>;
  submitLabel: string;
  onSubmit: (v: TaskFormValues) => void;
  saving?: boolean;
  fieldErrors?: Record<string, string>;
  voice?: boolean;
}) {
  const subjectsApi = useApi<{ items: Subject[] }>("/api/subjects");
  const subjects = subjectsApi.data?.items ?? [];
  const init = initial?.dueAt ? new Date(initial.dueAt) : null;

  const [title, setTitle] = useState(initial?.title ?? "");
  const [type, setType] = useState<TaskType>(initial?.type ?? "assignment");
  const [subjectId, setSubjectId] = useState<number | null>(initial?.subjectId ?? null);
  const [date, setDate] = useState(init ? localDayKey(init) : localDayKey(presetDate("tomorrow")));
  const [time, setTime] = useState(init ? `${String(init.getHours()).padStart(2, "0")}:${String(init.getMinutes()).padStart(2, "0")}` : "23:59");
  const [effort, setEffort] = useState<Effort>(initial?.effort ?? "M");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [showDesc, setShowDesc] = useState(!!initial?.description);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [voiceOpen, setVoiceOpen] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const subject = subjects.find((s) => s.id === subjectId);
  const allErrors = { ...errors, ...fieldErrors };

  function applyParsed(p: ParsedTask) {
    if (p.title) setTitle(p.title);
    if (p.type) setType(p.type);
    if (p.subjectId) setSubjectId(p.subjectId);
    if (p.due) {
      setDate(localDayKey(p.due));
      setTime(`${String(p.due.getHours()).padStart(2, "0")}:${String(p.due.getMinutes()).padStart(2, "0")}`);
    }
    if (p.effort) setEffort(p.effort);
    setVoiceOpen(false);
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (!title.trim()) errs.title = "Give your task a title.";
    const dueAt = new Date(`${date}T${time || "23:59"}`).getTime();
    if (!date || Number.isNaN(dueAt)) errs.dueAt = "Choose a due date.";
    setErrors(errs);
    if (Object.keys(errs).length) return;
    onSubmit({ title: title.trim(), type, subjectId, dueAt, effort, description: description.trim() || null });
  }

  return (
    <form onSubmit={submit} className="space-y-5" noValidate>
      <div>
        <Label htmlFor="title">Title</Label>
        <Input
          id="title"
          autoFocus={!initial}
          placeholder="e.g. Calculus Quiz 1"
          maxLength={120}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          error={allErrors.title}
          trailing={
            voice ? (
              <button type="button" aria-label="Add by voice" onClick={() => setVoiceOpen(true)} className="grid size-8 place-items-center rounded-full bg-brand-50 text-brand-700">
                <Mic className="size-4" />
              </button>
            ) : undefined
          }
        />
      </div>

      <div>
        <Label>Type</Label>
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 no-scrollbar">
          {TASK_TYPES.map((t) => (
            <Chip key={t.key} selected={type === t.key} onClick={() => setType(t.key)}>
              {t.label}
            </Chip>
          ))}
        </div>
      </div>

      <div>
        <Label>Subject</Label>
        <button type="button" onClick={() => setPickerOpen(true)} className="flex h-12 w-full items-center gap-3 rounded-2xl border border-line bg-white px-3 text-left">
          <SubjectIcon icon={subject?.icon} color={subject?.color} size={30} />
          <span className={cx("flex-1 font-medium", subject ? "text-ink" : "text-faint")}>{subject?.name ?? "Choose a subject (optional)"}</span>
          <ChevronRight className="size-5 text-faint" />
        </button>
      </div>

      <div>
        <Label hint={date ? fmtDateLong(new Date(`${date}T12:00`).getTime()) : undefined}>Due date</Label>
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 no-scrollbar">
          {PRESETS.map((p) => {
            const key = localDayKey(presetDate(p.key));
            return (
              <Chip key={p.key} selected={date === key} onClick={() => setDate(key)}>
                {p.label}
              </Chip>
            );
          })}
        </div>
        <div className="mt-2.5 grid grid-cols-[1fr_148px] gap-2">
          <Input type="date" aria-label="Due date" value={date} onChange={(e) => setDate(e.target.value)} leading={<CalendarDays className="size-4 text-faint" />} error={allErrors.dueAt} />
          <Input type="time" aria-label="Due time" value={time} onChange={(e) => setTime(e.target.value)} />
        </div>
      </div>

      <div>
        <Label>Effort size</Label>
        <div className="grid grid-cols-3 gap-2">
          {EFFORTS.map((e) => (
            <button
              key={e.key}
              type="button"
              aria-pressed={effort === e.key}
              onClick={() => setEffort(e.key)}
              className={cx("rounded-2xl border px-2 py-2.5 text-center transition-colors", effort === e.key ? "border-brand-700 bg-brand-700 text-white" : "border-line bg-white text-ink-2")}
            >
              <span className="block text-[15px] font-bold leading-tight">{e.label}</span>
              <span className={cx("block text-[11px]", effort === e.key ? "text-brand-100" : "text-muted")}>{e.hint}</span>
            </button>
          ))}
        </div>
      </div>

      <div>
        {showDesc ? (
          <>
            <Label htmlFor="desc" hint={<DictateButton label="Speak the description" onText={(t) => setDescription((d) => (d ? `${d} ${t}` : t))} />}>
              Description
            </Label>
            <Textarea id="desc" placeholder="Instructions, links, page numbers…" maxLength={2000} value={description} onChange={(e) => setDescription(e.target.value)} />
          </>
        ) : (
          <button type="button" onClick={() => setShowDesc(true)} className="px-1 text-sm font-semibold text-brand-700">
            + Add description
          </button>
        )}
      </div>

      <Button type="submit" full size="lg" loading={saving}>
        {submitLabel}
      </Button>

      <SubjectPicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        subjects={subjects}
        value={subjectId}
        onChange={setSubjectId}
        onCreated={(items) => subjectsApi.setData({ items })}
      />
      {voice && <VoiceTaskSheet open={voiceOpen} onClose={() => setVoiceOpen(false)} subjects={subjects} onApply={applyParsed} />}
    </form>
  );
}
