import { one, run } from "@/server/db";
import { err, idParam, ok, readJson, route } from "@/server/http";
import { requireAuth } from "@/server/auth";
import { getOwnedTask } from "@/server/tasks";
import { checklistItemSchema } from "@/shared/schemas";
import { LIMITS } from "@/shared/limits";

type Ctx = { params: Promise<{ id: string }> };

export const POST = route<Ctx>(async (req, ctx) => {
  const auth = await requireAuth();
  const task = await getOwnedTask(auth, idParam((await ctx.params).id));
  const { label } = await readJson(req, checklistItemSchema);
  const stats = (await one<{ n: number; max: number | null }>("SELECT COUNT(*) AS n, MAX(sort_order) AS max FROM task_checklist_items WHERE task_id = ?", task.id))!;
  if (stats.n >= LIMITS.maxChecklistItems) throw err.badRequest(`A task can have up to ${LIMITS.maxChecklistItems} checklist items.`);
  const { id } = await run(
    "INSERT INTO task_checklist_items (task_id, label, done, sort_order, created_at) VALUES (?, ?, 0, ?, ?)",
    task.id, label, (stats.max ?? 0) + 1, Date.now(),
  );
  await run("UPDATE tasks SET updated_at = ? WHERE id = ?", Date.now(), task.id);
  return ok({ item: { id, label, done: false } }, { status: 201 });
});
