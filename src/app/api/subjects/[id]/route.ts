import { isUniqueViolation, one, run } from "@/server/db";
import { err, idParam, ok, readJson, route } from "@/server/http";
import { requireAuth } from "@/server/auth";
import { subjectSchema } from "@/shared/schemas";
import { listSubjects } from "@/server/subjects";

type Ctx = { params: Promise<{ id: string }> };

function owned(userId: number, id: number) {
  const s = one<{ id: number; name: string; color: string; icon: string }>("SELECT id, name, color, icon FROM subjects WHERE id = ? AND user_id = ?", id, userId);
  if (!s) throw err.notFound("Subject not found.");
  return s;
}

export const PATCH = route<Ctx>(async (req, ctx) => {
  const auth = await requireAuth();
  const id = idParam((await ctx.params).id);
  const s = owned(auth.user.id, id);
  const input = await readJson(req, subjectSchema.partial());
  try {
    run("UPDATE subjects SET name = ?, color = ?, icon = ? WHERE id = ?", input.name ?? s.name, input.color ?? s.color, input.icon ?? s.icon, id);
  } catch (e) {
    if (isUniqueViolation(e)) throw err.conflict("SUBJECT_EXISTS", `You already have a subject called "${input.name}".`);
    throw e;
  }
  return ok({ items: listSubjects(auth.user.id) });
});

/** Deleting a subject keeps its tasks; they simply lose the subject label (ON DELETE SET NULL). */
export const DELETE = route<Ctx>(async (_req, ctx) => {
  const auth = await requireAuth();
  const id = idParam((await ctx.params).id);
  owned(auth.user.id, id);
  run("DELETE FROM subjects WHERE id = ? AND user_id = ?", id, auth.user.id);
  return ok({ items: listSubjects(auth.user.id) });
});
