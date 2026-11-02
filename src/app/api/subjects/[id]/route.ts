import { isUniqueViolation, one, run, tx } from "@/server/db";
import { err, idParam, ok, readJson, route } from "@/server/http";
import { requireAuth } from "@/server/auth";
import { subjectSchema } from "@/shared/schemas";
import { deleteSubject, listSubjects } from "@/server/subjects";

type Ctx = { params: Promise<{ id: string }> };

async function owned(userId: number, id: number) {
  const s = await one<{ id: number; name: string; color: string; icon: string }>("SELECT id, name, color, icon FROM subjects WHERE id = ? AND user_id = ?", id, userId);
  if (!s) throw err.notFound("Subject not found.");
  return s;
}

export const PATCH = route<Ctx>(async (req, ctx) => {
  const auth = await requireAuth();
  const id = idParam((await ctx.params).id);
  const s = await owned(auth.user.id, id);
  const input = await readJson(req, subjectSchema.partial());
  try {
    await run("UPDATE subjects SET name = ?, color = ?, icon = ? WHERE id = ?", input.name ?? s.name, input.color ?? s.color, input.icon ?? s.icon, id);
  } catch (e) {
    if (isUniqueViolation(e)) throw err.conflict("SUBJECT_EXISTS", `You already have a subject called "${input.name}".`);
    throw e;
  }
  return ok({ items: await listSubjects(auth.user.id) });
});

/** Deleting a subject keeps its tasks; they simply lose the subject label. */
export const DELETE = route<Ctx>(async (_req, ctx) => {
  const auth = await requireAuth();
  const id = idParam((await ctx.params).id);
  await owned(auth.user.id, id);
  await tx(() => deleteSubject(auth.user.id, id));
  return ok({ items: await listSubjects(auth.user.id) });
});
