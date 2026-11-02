import { isUniqueViolation, one, run, tx } from "@/server/db";
import { listSubjects } from "@/server/subjects";
import { err, ok, readJson, route } from "@/server/http";
import { requireAuth } from "@/server/auth";
import { subjectBulkSchema, subjectSchema } from "@/shared/schemas";
import { LIMITS } from "@/shared/limits";

export const GET = route(async () => {
  const auth = await requireAuth();
  return ok({ items: listSubjects(auth.user.id) });
});

/** Creates one subject (`{name,color,icon}`) or several at once (`{subjects:[...]}`, used by onboarding). */
export const POST = route(async (req) => {
  const auth = await requireAuth();
  const raw = await readJson(req, subjectSchema.or(subjectBulkSchema));
  const items = "subjects" in raw ? raw.subjects : [raw];
  const created = tx(() => {
    const count = one<{ n: number }>("SELECT COUNT(*) AS n FROM subjects WHERE user_id = ?", auth.user.id)!.n;
    if (count + items.length > LIMITS.maxSubjects) throw err.badRequest(`You can have up to ${LIMITS.maxSubjects} subjects.`);
    const ids: number[] = [];
    for (const s of items) {
      try {
        ids.push(run("INSERT INTO subjects (user_id, name, color, icon, created_at) VALUES (?, ?, ?, ?, ?)", auth.user.id, s.name, s.color, s.icon, Date.now()).id);
      } catch (e) {
        if (!isUniqueViolation(e)) throw e;
        if (items.length === 1) throw err.conflict("SUBJECT_EXISTS", `You already have a subject called "${s.name}".`);
      }
    }
    return ids;
  });
  const all_ = listSubjects(auth.user.id);
  return ok({ items: all_, created: all_.filter((s) => created.includes(s.id)) }, { status: 201 });
});
