"use client";

import { useMemo, useState } from "react";
import { Check, Plus, Search } from "lucide-react";
import { api, ApiClientError } from "@/lib/api";
import type { SubjectDTO } from "@/server/subjects";
import { SUBJECT_COLORS, SUBJECT_ICONS, SUBJECT_PRESETS } from "@/shared/catalog";
import { Sheet } from "./Sheet";
import { SUBJECT_ICON_MAP, SubjectIcon } from "./SubjectIcon";
import { Button, Input, Label, cx } from "./ui";

export type Subject = SubjectDTO;

export function SubjectEditor({ initial, onSave, saving, error }: { initial?: Partial<Subject>; onSave: (v: { name: string; color: string; icon: string }) => void; saving?: boolean; error?: string | null }) {
  const [name, setName] = useState(initial?.name ?? "");
  const [color, setColor] = useState(initial?.color ?? SUBJECT_COLORS[0]);
  const [icon, setIcon] = useState(initial?.icon ?? "book");
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (name.trim()) onSave({ name: name.trim(), color, icon });
      }}
      className="space-y-4"
    >
      <div className="flex items-center gap-3">
        <SubjectIcon icon={icon} color={color} size={48} />
        <div className="flex-1">
          <Input aria-label="Subject name" placeholder="e.g. Embedded Systems" maxLength={40} value={name} onChange={(e) => setName(e.target.value)} error={error ?? undefined} autoFocus />
        </div>
      </div>
      <div>
        <Label>Colour</Label>
        <div className="flex flex-wrap gap-2.5 px-1">
          {SUBJECT_COLORS.map((c) => (
            <button key={c} type="button" aria-label={`Colour ${c}`} onClick={() => setColor(c)} className={cx("grid size-9 place-items-center rounded-full", color === c && "ring-2 ring-offset-2")} style={{ background: c, ["--tw-ring-color" as string]: c }}>
              {color === c && <Check className="size-4 text-white" strokeWidth={3} />}
            </button>
          ))}
        </div>
      </div>
      <div>
        <Label>Icon</Label>
        <div className="grid grid-cols-6 gap-2 px-1">
          {SUBJECT_ICONS.map((k) => {
            const Icon = SUBJECT_ICON_MAP[k];
            return (
              <button key={k} type="button" aria-label={k} aria-pressed={icon === k} onClick={() => setIcon(k)} className={cx("grid aspect-square place-items-center rounded-xl border", icon === k ? "border-brand-600 bg-brand-50 text-brand-700" : "border-line text-ink-2")}>
                <Icon className="size-5" />
              </button>
            );
          })}
        </div>
      </div>
      <Button type="submit" full loading={saving} disabled={!name.trim()}>
        Save subject
      </Button>
    </form>
  );
}

export function SubjectPicker({
  open,
  onClose,
  subjects,
  value,
  onChange,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  subjects: Subject[];
  value: number | null;
  onChange: (id: number | null) => void;
  onCreated: (items: Subject[], created: Subject | undefined) => void;
}) {
  const [q, setQ] = useState("");
  const [adding, setAdding] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const list = useMemo(() => subjects.filter((s) => s.name.toLowerCase().includes(q.toLowerCase())), [subjects, q]);
  const suggestions = SUBJECT_PRESETS.filter((p) => !subjects.some((s) => s.name.toLowerCase() === p.name.toLowerCase()) && p.name.toLowerCase().includes(q.toLowerCase())).slice(0, 4);

  async function create(v: { name: string; color: string; icon: string }) {
    setSaving(true);
    setError(null);
    try {
      const r = await api<{ items: Subject[]; created: Subject[] }>("/api/subjects", { body: v });
      onCreated(r.items, r.created[0]);
      if (r.created[0]) onChange(r.created[0].id);
      setAdding(false);
      setQ("");
      onClose();
    } catch (e) {
      setError(e instanceof ApiClientError ? e.message : "Couldn't add subject.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Sheet open={open} onClose={() => { setAdding(false); onClose(); }} title={adding ? "New subject" : "Select subject"}>
      {adding ? (
        <SubjectEditor initial={{ name: q }} onSave={create} saving={saving} error={error} />
      ) : (
        <>
          <Input leading={<Search className="size-4 text-faint" />} placeholder="Search subjects…" value={q} onChange={(e) => setQ(e.target.value)} />
          <ul className="mt-3 divide-y divide-line">
            <li>
              <button type="button" onClick={() => { onChange(null); onClose(); }} className="flex w-full items-center gap-3 py-3">
                <SubjectIcon size={36} />
                <span className="flex-1 text-left font-medium text-ink-2">No subject</span>
                <Radio checked={value === null} />
              </button>
            </li>
            {list.map((s) => (
              <li key={s.id}>
                <button type="button" onClick={() => { onChange(s.id); onClose(); }} className="flex w-full items-center gap-3 py-3">
                  <SubjectIcon icon={s.icon} color={s.color} size={36} />
                  <span className="flex-1 text-left font-medium text-ink">{s.name}</span>
                  <Radio checked={value === s.id} />
                </button>
              </li>
            ))}
          </ul>
          {suggestions.length > 0 && (
            <div className="mt-3">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-faint">Quick add</p>
              <div className="flex flex-wrap gap-2">
                {suggestions.map((p) => (
                  <button key={p.name} type="button" disabled={saving} onClick={() => create(p)} className="inline-flex h-9 items-center gap-1.5 rounded-full border border-line bg-white px-3 text-sm font-medium text-ink-2">
                    <Plus className="size-3.5" /> {p.name}
                  </button>
                ))}
              </div>
            </div>
          )}
          <Button variant="secondary" full className="mt-4" icon={<Plus className="size-4" />} onClick={() => setAdding(true)}>
            Create subject{q ? ` "${q}"` : ""}
          </Button>
        </>
      )}
    </Sheet>
  );
}

function Radio({ checked }: { checked: boolean }) {
  return (
    <span className={cx("grid size-6 place-items-center rounded-full border-2", checked ? "border-brand-700" : "border-slate-300")}>
      {checked && <span className="size-3 rounded-full bg-brand-700" />}
    </span>
  );
}
