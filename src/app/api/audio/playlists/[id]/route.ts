import { run } from "@/server/db";
import { err, idParam, ok, route } from "@/server/http";
import { requireAuth } from "@/server/auth";

type Ctx = { params: Promise<{ id: string }> };

export const DELETE = route<Ctx>(async (_req, ctx) => {
  const auth = await requireAuth();
  const id = idParam((await ctx.params).id);
  const r = await run("DELETE FROM spotify_playlists WHERE id = ? AND user_id = ?", id, auth.user.id);
  if (!r.changes) throw err.notFound();
  return ok({ ok: true });
});
