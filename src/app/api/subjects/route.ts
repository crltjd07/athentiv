import { isUniqueViolation, one, run, tx } from "@/server/db";
import { listSubjects } from "@/server/subjects";
import { err, ok, readJson, route } from "@/server/http";
import { requireAuth } from "@/server/auth";
import { subjectBulkSchema, subjectSchema } from "@/shared/schemas";
import { LIMITS } from "@/shared/limits";

export const GET = route(async () => {
  const auth = await requireAuth();
  return ok({ items: await listSubjects(auth.user.id) });
});

/** Creates one subject (`{name,color,icon}`) or several at once (`{subjects:[...]}`, used by onboarding). */
export const POST = route(async (req) => {
  const auth = await requireAuth();
  const raw = await readJson(req, subjectSchema.or(subjectBulkSchema));
  const items = "subjects" in raw ? raw.subjects : [raw];
  const created = await tx(async () => {
    const count = (await one<{ n: number }>("SELECT COUNT(*) AS n FROM subjects WHERE user_id = ?", auth.user.id))!.n;
    if (count + items.length > LIMITS.maxSubjects) throw err.badRequest(`You can have up to ${LIMITS.maxSubjects} subjects.`);
    const ids: number[] = [];
    for (const s of items) {
      // Check first instead of relying on a failed INSERT, which would abort the transaction.
      if (await one("SELECT 1 FROM subjects WHERE user_id = ? AND name = ?", auth.user.id, s.name)) {
        if (items.length === 1) throw err.conflict("SUBJECT_EXISTS", `You already have a subject called "${s.name}".`);
        continue;
      }
      try {
        ids.push((await run("INSERT INTO subjects (user_id, name, color, icon, created_at) VALUES (?, ?, ?, ?, ?)", auth.user.id, s.name, s.color, s.icon, Date.now())).id);
      } catch (e) {
        if (isUniqueViolation(e)) throw err.conflict("SUBJECT_EXISTS", `You already have a subject called "${s.name}".`);
        throw e;
      }
    }
    return ids;
  });
  const all_ = await listSubjects(auth.user.id);
  return ok({ items: all_, created: all_.filter((s) => created.includes(s.id)) }, { status: 201 });
});
