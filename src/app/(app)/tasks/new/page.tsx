"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { api, ApiClientError } from "@/lib/api";
import { PageHeader } from "@/components/Nav";
import { LockedCard, useApiErrorHandler } from "@/components/Premium";
import { TaskForm, type TaskFormValues } from "@/components/TaskForm";
import { useToast } from "@/components/Toast";

export default function NewTask() {
  const router = useRouter();
  const toast = useToast();
  const onError = useApiErrorHandler();
  const [saving, setSaving] = useState(false);
  const [fields, setFields] = useState<Record<string, string>>({});
  const [limitHit, setLimitHit] = useState(false);

  async function save(v: TaskFormValues) {
    setSaving(true);
    setFields({});
    try {
      const r = await api<{ task: { id: number } }>("/api/tasks", { body: v });
      toast("Task saved");
      router.replace(`/tasks/${r.task.id}`);
    } catch (e) {
      if (e instanceof ApiClientError && e.code === "TASK_LIMIT") setLimitHit(true);
      else if (e instanceof ApiClientError && e.code === "VALIDATION") setFields(e.fields);
      else onError(e);
      setSaving(false);
    }
  }

  return (
    <main className="mx-auto max-w-[480px] px-4">
      <PageHeader title="Add Assignment" back />
      {limitHit && (
        <LockedCard
          className="mb-4"
          title="You've reached 3 open tasks"
          body="Freemium keeps up to three open tasks at a time. Complete or delete one to free a slot, or upgrade for unlimited tasks."
          feature="Unlimited tasks"
        />
      )}
      <TaskForm submitLabel="Save Task" onSubmit={save} saving={saving} fieldErrors={fields} voice />
    </main>
  );
}
