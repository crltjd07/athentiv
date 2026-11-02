"use client";

import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { api, ApiClientError } from "@/lib/api";
import { useApi } from "@/lib/useApi";
import { PageHeader } from "@/components/Nav";
import { useApiErrorHandler } from "@/components/Premium";
import { TaskForm, type TaskFormValues } from "@/components/TaskForm";
import type { Task } from "@/components/TaskBits";
import { useToast } from "@/components/Toast";
import { ErrorState, PageSkeleton } from "@/components/ui";

export default function EditTask() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const toast = useToast();
  const onError = useApiErrorHandler();
  const { data, error, reload } = useApi<{ task: Task }>(`/api/tasks/${id}`);
  const [saving, setSaving] = useState(false);
  const [fields, setFields] = useState<Record<string, string>>({});

  async function save(v: TaskFormValues) {
    setSaving(true);
    try {
      await api(`/api/tasks/${id}`, { method: "PATCH", body: v });
      toast("Changes saved");
      router.replace(`/tasks/${id}`);
    } catch (e) {
      if (e instanceof ApiClientError && e.code === "VALIDATION") setFields(e.fields);
      else onError(e);
      setSaving(false);
    }
  }

  return (
    <main className="mx-auto max-w-[480px] px-4">
      <PageHeader title="Edit Task" back />
      {error ? (
        <ErrorState message={error.message} onRetry={reload} />
      ) : !data ? (
        <PageSkeleton />
      ) : (
        <TaskForm
          initial={{ title: data.task.title, type: data.task.type as TaskFormValues["type"], subjectId: data.task.subjectId, dueAt: data.task.dueAt, effort: data.task.effort, description: data.task.description }}
          submitLabel="Save changes"
          onSubmit={save}
          saving={saving}
          fieldErrors={fields}
        />
      )}
    </main>
  );
}
