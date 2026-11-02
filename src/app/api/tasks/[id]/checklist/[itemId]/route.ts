import { one, run } from "@/server/db";
import { err, idParam, ok, readJson, route } from "@/server/http";
import { requireAuth } from "@/server/auth";
import { getOwnedTask } from "@/server/tasks";
import { checklistPatchSchema } from "@/shared/schemas";

type Ctx = { params: Promise<{ id: string; itemId: string }> };

async function ownedItem(ctx: Ctx) {
  const auth = await requireAuth();
  const p = await ctx.params;
  const task = await getOwnedTask(auth, idParam(p.id));
  const itemId = idParam(p.itemId);
  const item = await one<{ id: number; label: string; done: number }>("SELECT id, label, done FROM task_checklist_items WHERE id = ? AND task_id = ?", itemId, task.id);
  if (!item) throw err.notFound("Checklist item not found.");
  return { task, item };
}

export const PATCH = route<Ctx>(async (req, ctx) => {
  const { task, item } = await ownedItem(ctx);
  const input = await readJson(req, checklistPatchSchema);
  const done = input.done ?? !!item.done;
  await run(
    "UPDATE task_checklist_items SET label = ?, done = ?, done_at = CASE WHEN ? THEN COALESCE(done_at, ?) ELSE NULL END WHERE id = ?",
    input.label ?? item.label, done, done, Date.now(), item.id,
  );
  await run("UPDATE tasks SET updated_at = ? WHERE id = ?", Date.now(), task.id);
  return ok({ item: { id: item.id, label: input.label ?? item.label, done } });
});

export const DELETE = route<Ctx>(async (_req, ctx) => {
  const { task, item } = await ownedItem(ctx);
  await run("DELETE FROM task_checklist_items WHERE id = ?", item.id);
  await run("UPDATE tasks SET updated_at = ? WHERE id = ?", Date.now(), task.id);
  return ok({ ok: true });
});
