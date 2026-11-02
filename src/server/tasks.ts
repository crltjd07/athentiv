import { all, one, run } from "./db";
import { err } from "./http";
import type { Auth } from "./auth";
import { isPremium } from "./access";
import { recomputeAt, checkAchievements } from "./activity";
import { LIMITS, TIME } from "@/shared/limits";
import type { TaskStatus } from "@/shared/catalog";

export type TaskRow = {
  id: number;
  user_id: number;
  subject_id: number | null;
  title: string;
  type: string;
  due_at: number;
  effort: "S" | "M" | "L";
  description: string | null;
  status: "pending" | "in_progress" | "completed";
  completed_at: number | null;
  created_at: number;
  updated_at: number;
  subject_name?: string | null;
  subject_color?: string | null;
  subject_icon?: string | null;
  checklist_total?: number;
  checklist_done?: number;
  focus_seconds?: number;
};

export const TASK_SELECT = `
  SELECT t.*, s.name AS subject_name, s.color AS subject_color, s.icon AS subject_icon,
         (SELECT COUNT(*) FROM task_checklist_items c WHERE c.task_id = t.id) AS checklist_total,
         (SELECT COUNT(*) FROM task_checklist_items c WHERE c.task_id = t.id AND c.done = 1) AS checklist_done,
         (SELECT COALESCE(SUM(p.focused_seconds), 0) FROM pomodoro_sessions p
           WHERE p.task_id = t.id AND p.kind = 'focus' AND p.status IN ('completed', 'ended_early')) AS focus_seconds
    FROM tasks t LEFT JOIN subjects s ON s.id = t.subject_id`;

export function derivedStatus(t: Pick<TaskRow, "status" | "due_at">, now: number): TaskStatus {
  if (t.status === "completed") return "completed";
  return t.due_at < now ? "overdue" : t.status;
}

export function priorityOf(t: Pick<TaskRow, "status" | "due_at" | "effort">, now: number): "high" | "medium" | "low" | null {
  if (t.status === "completed") return null;
  const left = t.due_at - now;
  if (left < TIME.DAY || (t.effort === "L" && left < 3 * TIME.DAY)) return "high";
  if (left < 3 * TIME.DAY || (t.effort !== "S" && left < 7 * TIME.DAY)) return "medium";
  return "low";
}

export function serializeTask(t: TaskRow, now: number) {
  return {
    id: t.id,
    title: t.title,
    type: t.type,
    subjectId: t.subject_name ? t.subject_id : null,
    subject: t.subject_id && t.subject_name ? { id: t.subject_id, name: t.subject_name, color: t.subject_color!, icon: t.subject_icon! } : null,
    dueAt: t.due_at,
    effort: t.effort,
    description: t.description,
    status: derivedStatus(t, now),
    storedStatus: t.status,
    priority: priorityOf(t, now),
    completedAt: t.completed_at,
    createdAt: t.created_at,
    updatedAt: t.updated_at,
    checklist: { total: t.checklist_total ?? 0, done: t.checklist_done ?? 0 },
    focusMinutes: Math.round((t.focus_seconds ?? 0) / 60),
  };
}
export type TaskDTO = ReturnType<typeof serializeTask>;

export async function getOwnedTask(auth: Auth, id: number): Promise<TaskRow> {
  const t = await one<TaskRow>(`${TASK_SELECT} WHERE t.id = ? AND t.user_id = ?`, id, auth.user.id);
  if (!t) throw err.notFound("Task not found.");
  return t;
}

export async function openTaskCount(userId: number): Promise<number> {
  return (await one<{ n: number }>("SELECT COUNT(*) AS n FROM tasks WHERE user_id = ? AND status != 'completed'", userId))!.n;
}

/** Freemium accounts may hold at most three open (not completed) tasks. Call inside a transaction. */
export async function assertCanOpenTask(auth: Auth) {
  if (await isPremium(auth.user.id, auth.now)) return;
  const open = await openTaskCount(auth.user.id);
  if (open >= LIMITS.freeOpenTasks) {
    throw err.forbidden(
      "TASK_LIMIT",
      `Freemium accounts can have ${LIMITS.freeOpenTasks} open tasks at a time. Complete or delete one, or upgrade to Premium for unlimited tasks.`,
      { limit: LIMITS.freeOpenTasks, open },
    );
  }
}

export async function assertOwnedSubject(auth: Auth, subjectId: number | null | undefined) {
  if (subjectId == null) return;
  if (!(await one("SELECT 1 FROM subjects WHERE id = ? AND user_id = ?", subjectId, auth.user.id))) {
    throw err.badRequest("That subject doesn't exist.");
  }
}

/** Changes a task's stored status, logs it, and keeps rollups/achievements current. */
export async function changeStatus(auth: Auth, task: TaskRow, to: TaskRow["status"], source: "user" | "pomodoro" | "system") {
  if (task.status === to) return;
  if (task.status === "completed" && to !== "completed") await assertCanOpenTask(auth);
  const now = Date.now();
  const completedAt = to === "completed" ? now : null;
  await run("UPDATE tasks SET status = ?, completed_at = ?, updated_at = ? WHERE id = ?", to, completedAt, now, task.id);
  await run(
    "INSERT INTO task_status_history (task_id, from_status, to_status, source, changed_at) VALUES (?, ?, ?, ?, ?)",
    task.id, task.status, to, source, now,
  );
  await recomputeAt(auth.user.id, auth.tz, task.completed_at, completedAt);
  if (to === "completed") await checkAchievements(auth.user.id, auth.tz, auth.user.account_type === "stand_owner");
}

/**
 * Deletes a task and everything that depends on it. Done explicitly (not only via ON DELETE
 * rules) so behaviour is identical whether or not the database enforces foreign keys.
 */
export async function deleteTask(auth: Auth, task: TaskRow) {
  await run("DELETE FROM task_checklist_items WHERE task_id = ?", task.id);
  await run("DELETE FROM task_status_history WHERE task_id = ?", task.id);
  await run("UPDATE pomodoro_sessions SET task_id = NULL WHERE task_id = ? AND user_id = ?", task.id, auth.user.id);
  await run("DELETE FROM tasks WHERE id = ? AND user_id = ?", task.id, auth.user.id);
  await recomputeAt(auth.user.id, auth.tz, task.created_at, task.completed_at);
}

export async function statusHistory(taskId: number) {
  return (await all<{ from_status: string | null; to_status: string; source: string; changed_at: number }>(
    "SELECT from_status, to_status, source, changed_at FROM task_status_history WHERE task_id = ? ORDER BY changed_at DESC LIMIT 20",
    taskId,
  )).map((h) => ({ from: h.from_status, to: h.to_status, source: h.source, at: h.changed_at }));
}
