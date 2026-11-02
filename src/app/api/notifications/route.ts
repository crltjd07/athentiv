import { z } from "zod";
import { all, run } from "@/server/db";
import { ok, readJson, route } from "@/server/http";
import { requireAuth } from "@/server/auth";
import { sweepNotifications } from "@/server/activity";

export const GET = route(async () => {
  const auth = await requireAuth();
  sweepNotifications(auth, true);
  const items = all<{ id: number; kind: string; title: string; body: string; link: string | null; read_at: number | null; created_at: number }>(
    "SELECT id, kind, title, body, link, read_at, created_at FROM user_notifications WHERE user_id = ? ORDER BY created_at DESC, id DESC LIMIT 60",
    auth.user.id,
  ).map((n) => ({ id: n.id, kind: n.kind, title: n.title, body: n.body, link: n.link, read: !!n.read_at, createdAt: n.created_at }));
  return ok({ items });
});

/** Marks notifications as read: `{ all: true }` or `{ ids: [...] }`. */
export const POST = route(async (req) => {
  const auth = await requireAuth();
  const input = await readJson(req, z.object({ all: z.boolean().optional(), ids: z.array(z.number().int().positive()).max(100).optional() }));
  const now = Date.now();
  if (input.all) run("UPDATE user_notifications SET read_at = ? WHERE user_id = ? AND read_at IS NULL", now, auth.user.id);
  for (const id of input.ids ?? []) run("UPDATE user_notifications SET read_at = ? WHERE id = ? AND user_id = ? AND read_at IS NULL", now, id, auth.user.id);
  return ok({ ok: true });
});
