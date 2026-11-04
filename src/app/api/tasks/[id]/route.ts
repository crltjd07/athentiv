import { all, run, tx } from "@/server/db";
import { idParam, ok, readJson, route } from "@/server/http";
import { requireMember } from "@/server/auth";
import { isPremium } from "@/server/access";
import { assertOwnedSubject, deleteTask, getOwnedTask, serializeTask, statusHistory } from "@/server/tasks";
import { taskPatchSchema } from "@/shared/schemas";

type Ctx = { params: Promise<{ id: string }> };

export const GET = route<Ctx>(async (_req, ctx) => {
  const auth = await requireMember();
  const task = await getOwnedTask(auth, idParam((await ctx.params).id));
  const checklist = (await all<{ id: number; label: string; done: number; sort_order: number }>(
    "SELECT id, label, done, sort_order FROM task_checklist_items WHERE task_id = ? ORDER BY sort_order, id", task.id,
  )).map((c) => ({ id: c.id, label: c.label, done: !!c.done }));

  // Task-linked focus history is a Premium insight; the total minutes are shown to everyone.
  const standOwner = auth.user.account_type === "stand_owner";
  const sessions = standOwner && (await isPremium(auth.user.id, auth.now))
    ? (await all<{ id: number; started_at: number; focused_seconds: number; status: string }>(
        `SELECT id, started_at, focused_seconds, status FROM pomodoro_sessions
          WHERE task_id = ? AND user_id = ? AND kind = 'focus' AND status IN ('completed', 'ended_early')
          ORDER BY started_at DESC LIMIT 20`,
        task.id, auth.user.id,
      )).map((s) => ({ id: s.id, startedAt: s.started_at, minutes: Math.round(s.focused_seconds / 60), status: s.status }))
    : null;

  return ok({ task: serializeTask(task, auth.now), checklist, history: await statusHistory(task.id), focusSessions: sessions });
});

export const PATCH = route<Ctx>(async (req, ctx) => {
  const auth = await requireMember();
  const id = idParam((await ctx.params).id);
  const input = await readJson(req, taskPatchSchema);
  const task = await tx(async () => {
    const t = await getOwnedTask(auth, id);
    if (input.subjectId !== undefined) await assertOwnedSubject(auth, input.subjectId);
    await run(
      `UPDATE tasks SET title = ?, type = ?, subject_id = ?, due_at = ?, effort = ?, description = ?, updated_at = ? WHERE id = ?`,
      input.title ?? t.title,
      input.type ?? t.type,
      input.subjectId === undefined ? t.subject_id : input.subjectId,
      input.dueAt ?? t.due_at,
      input.effort ?? t.effort,
      input.description === undefined ? t.description : input.description || null,
      Date.now(),
      id,
    );
    return getOwnedTask(auth, id);
  });
  return ok({ task: serializeTask(task, Date.now()) });
});

/** Deleting frees an open-task slot. Linked focus sessions are kept as "General study". */
export const DELETE = route<Ctx>(async (_req, ctx) => {
  const auth = await requireMember();
  const id = idParam((await ctx.params).id);
  await tx(async () => deleteTask(auth, await getOwnedTask(auth, id)));
  return ok({ ok: true });
});
