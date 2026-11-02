import { z } from "zod";
import { all, run, tx } from "@/server/db";
import { err, ok, readJson, readQuery, route } from "@/server/http";
import { requireAuth } from "@/server/auth";
import { isPremium } from "@/server/access";
import { recomputeAt, checkAchievements } from "@/server/activity";
import { assertCanOpenTask, assertOwnedSubject, getOwnedTask, openTaskCount, serializeTask, TASK_SELECT, type TaskRow } from "@/server/tasks";
import { taskSchema } from "@/shared/schemas";
import { EFFORT_KEYS, TASK_TYPE_KEYS } from "@/shared/catalog";
import { LIMITS } from "@/shared/limits";

const querySchema = z.object({
  status: z.enum(["all", "open", "pending", "in_progress", "overdue", "completed"]).default("all"),
  type: z.enum(TASK_TYPE_KEYS).optional(),
  subject: z.coerce.number().int().optional(),
  effort: z.enum(EFFORT_KEYS).optional(),
  q: z.string().trim().max(80).optional(),
  sort: z.enum(["due", "due_desc", "created", "effort", "subject"]).default("due"),
  dueFrom: z.coerce.number().int().optional(),
  dueTo: z.coerce.number().int().optional(),
  limit: z.coerce.number().int().min(1).max(500).default(200),
});

export const GET = route(async (req) => {
  const auth = await requireAuth();
  const q = readQuery(req, querySchema);
  const premium = await isPremium(auth.user.id, auth.now);

  // Advanced filters and sorts are Premium-only — enforced here, not just hidden in the UI.
  if (!premium && (q.subject !== undefined || q.effort !== undefined || q.sort === "effort" || q.sort === "subject")) {
    throw err.forbidden("PREMIUM_REQUIRED", "Filtering and sorting by subject or effort is a Premium feature.", { feature: "Advanced task filters" });
  }

  const where = ["t.user_id = ?"];
  const params: (string | number)[] = [auth.user.id];
  const now = auth.now;
  switch (q.status) {
    case "open": where.push("t.status != 'completed'"); break;
    case "pending": where.push("t.status = 'pending' AND t.due_at >= ?"); params.push(now); break;
    case "in_progress": where.push("t.status = 'in_progress' AND t.due_at >= ?"); params.push(now); break;
    case "overdue": where.push("t.status != 'completed' AND t.due_at < ?"); params.push(now); break;
    case "completed": where.push("t.status = 'completed'"); break;
  }
  if (q.type) { where.push("t.type = ?"); params.push(q.type); }
  if (q.subject !== undefined) {
    if (q.subject === 0) where.push("t.subject_id IS NULL");
    else { where.push("t.subject_id = ?"); params.push(q.subject); }
  }
  if (q.effort) { where.push("t.effort = ?"); params.push(q.effort); }
  if (q.q) {
    where.push("(t.title LIKE ? ESCAPE '\\' OR t.description LIKE ? ESCAPE '\\')");
    const like = "%" + q.q.replace(/[\\%_]/g, (c) => "\\" + c) + "%";
    params.push(like, like);
  }
  if (q.dueFrom !== undefined) { where.push("t.due_at >= ?"); params.push(q.dueFrom); }
  if (q.dueTo !== undefined) { where.push("t.due_at < ?"); params.push(q.dueTo); }

  const order = {
    due: q.status === "completed" ? "t.completed_at DESC" : "t.status = 'completed', t.due_at ASC",
    due_desc: "t.due_at DESC",
    created: "t.created_at DESC",
    effort: "t.status = 'completed', CASE t.effort WHEN 'L' THEN 0 WHEN 'M' THEN 1 ELSE 2 END, t.due_at",
    subject: "t.status = 'completed', s.name IS NULL, s.name COLLATE NOCASE, t.due_at",
  }[q.sort];

  const rows = await all<TaskRow>(`${TASK_SELECT} WHERE ${where.join(" AND ")} ORDER BY ${order} LIMIT ?`, ...params, q.limit);
  return ok({
    items: rows.map((r) => serializeTask(r, now)),
    openCount: await openTaskCount(auth.user.id),
    maxOpen: premium ? null : LIMITS.freeOpenTasks,
  });
});

export const POST = route(async (req) => {
  const auth = await requireAuth();
  const input = await readJson(req, taskSchema);
  const task = await tx(async () => {
    await assertCanOpenTask(auth);
    await assertOwnedSubject(auth, input.subjectId);
    const now = Date.now();
    const { id } = await run(
      `INSERT INTO tasks (user_id, subject_id, title, type, due_at, effort, description, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)`,
      auth.user.id, input.subjectId, input.title, input.type, input.dueAt, input.effort, input.description || null, now, now,
    );
    await run("INSERT INTO task_status_history (task_id, from_status, to_status, source, changed_at) VALUES (?, NULL, 'pending', 'user', ?)", id, now);
    await recomputeAt(auth.user.id, auth.tz, now);
    await checkAchievements(auth.user.id, auth.tz, auth.user.account_type === "stand_owner");
    return getOwnedTask(auth, id);
  });
  return ok({ task: serializeTask(task, Date.now()) }, { status: 201 });
});
