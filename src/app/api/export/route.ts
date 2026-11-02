import { z } from "zod";
import { all } from "@/server/db";
import { ok, rateLimit, readQuery, route } from "@/server/http";
import { requireAuth } from "@/server/auth";
import { buildExport } from "@/server/exports";
import { isDayString } from "@/shared/day";

const day = z.string().refine(isDayString, "Use YYYY-MM-DD.");
const schema = z.object({
  kind: z.enum(["tasks", "pomodoro", "stats", "mood", "full"]),
  format: z.enum(["csv", "pdf", "json"]),
  from: day,
  to: day,
});

/** Streams the export as a download. Premium-only; mood requires a Premium stand owner. */
export const GET = route(async (req) => {
  const auth = await requireAuth();
  if (req.nextUrl.searchParams.get("history") === "1") {
    const items = all<{ id: number; kind: string; format: string; range_start: number; range_end: number; status: string; row_count: number | null; created_at: number }>(
      "SELECT * FROM export_requests WHERE user_id = ? ORDER BY created_at DESC LIMIT 15", auth.user.id,
    ).map((e) => ({ id: e.id, kind: e.kind, format: e.format, status: e.status, rows: e.row_count, createdAt: e.created_at }));
    return ok({ items });
  }
  rateLimit(`export:${auth.user.id}`, 30, 60 * 60_000);
  const q = readQuery(req, schema);
  const from = q.from <= q.to ? q.from : q.to;
  const to = q.from <= q.to ? q.to : q.from;
  const file = buildExport(auth, q.kind, q.format, from, to);
  const body = typeof file.body === "string" ? file.body : new Uint8Array(file.body);
  return new Response(body, {
    headers: {
      "Content-Type": file.contentType,
      "Content-Disposition": `attachment; filename="${file.filename}"`,
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
});
