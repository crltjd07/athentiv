"use client";

import { useState } from "react";
import { BookMarked, Pencil, Plus, Trash2 } from "lucide-react";
import { api, ApiClientError } from "@/lib/api";
import { useApi } from "@/lib/useApi";
import { PageHeader } from "@/components/Nav";
import { useApiErrorHandler } from "@/components/Premium";
import { Sheet, useConfirm } from "@/components/Sheet";
import { SubjectEditor, type Subject } from "@/components/Subjects";
import { SubjectIcon } from "@/components/SubjectIcon";
import { useToast } from "@/components/Toast";
import { Button, Card, EmptyState, ErrorState, PageSkeleton } from "@/components/ui";

export default function SubjectsPage() {
  const { data, error, loading, reload, setData } = useApi<{ items: Subject[] }>("/api/subjects");
  const [editing, setEditing] = useState<Subject | "new" | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const confirm = useConfirm();
  const toast = useToast();
  const onError = useApiErrorHandler();

  async function save(v: { name: string; color: string; icon: string }) {
    setSaving(true);
    setFormError(null);
    try {
      const r = editing === "new"
        ? await api<{ items: Subject[] }>("/api/subjects", { body: v })
        : await api<{ items: Subject[] }>(`/api/subjects/${(editing as Subject).id}`, { method: "PATCH", body: v });
      setData({ items: r.items });
      setEditing(null);
      toast(editing === "new" ? "Subject added" : "Subject updated");
    } catch (e) {
      setFormError(e instanceof ApiClientError ? e.message : "Couldn't save.");
    } finally {
      setSaving(false);
    }
  }

  async function remove(s: Subject) {
    const ok = await confirm({
      title: `Delete ${s.name}?`,
      body: s.totalTasks ? `Its ${s.totalTasks} task${s.totalTasks === 1 ? "" : "s"} will be kept without a subject.` : "This subject has no tasks.",
      confirmLabel: "Delete subject",
      danger: true,
    });
    if (!ok) return;
    try {
      const r = await api<{ items: Subject[] }>(`/api/subjects/${s.id}`, { method: "DELETE" });
      setData({ items: r.items });
      toast("Subject deleted");
    } catch (e) {
      onError(e);
    }
  }

  return (
    <main className="mx-auto max-w-[480px] px-4">
      <PageHeader title="Subjects" back />
      {loading && !data ? (
        <PageSkeleton />
      ) : error ? (
        <ErrorState message={error.message} onRetry={reload} />
      ) : data?.items.length === 0 ? (
        <EmptyState icon={<BookMarked className="size-7" />} title="No subjects yet" body="Subjects help you group tasks and see where your study time goes." />
      ) : (
        <Card as="section" className="divide-y divide-line">
          {data?.items.map((s) => (
            <div key={s.id} className="flex items-center gap-3 px-4 py-3">
              <SubjectIcon icon={s.icon} color={s.color} />
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold text-ink">{s.name}</p>
                <p className="text-xs text-muted">
                  {s.openTasks} open · {s.totalTasks} total
                </p>
              </div>
              <button aria-label={`Edit ${s.name}`} onClick={() => { setFormError(null); setEditing(s); }} className="grid size-10 place-items-center rounded-full text-ink-2 active:bg-black/5">
                <Pencil className="size-4" />
              </button>
              <button aria-label={`Delete ${s.name}`} onClick={() => remove(s)} className="grid size-10 place-items-center rounded-full text-red-500 active:bg-red-50">
                <Trash2 className="size-4" />
              </button>
            </div>
          ))}
        </Card>
      )}
      <Button full className="mt-4" icon={<Plus className="size-4" />} onClick={() => { setFormError(null); setEditing("new"); }}>
        Add subject
      </Button>
      <Sheet open={editing !== null} onClose={() => setEditing(null)} title={editing === "new" ? "New subject" : "Edit subject"}>
        {editing !== null && <SubjectEditor key={editing === "new" ? "new" : editing.id} initial={editing === "new" ? undefined : editing} onSave={save} saving={saving} error={formError} />}
      </Sheet>
    </main>
  );
}
