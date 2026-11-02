import { one } from "@/server/db";
import { ok, route } from "@/server/http";
import { requireAuth } from "@/server/auth";
import { accessFor, requireStandOwner } from "@/server/access";
import { sessionHistory } from "@/server/pomodoro";

/** Freemium: last 5 sessions, no statistics. Premium: last 20 sessions plus statistics. */
export const GET = route(async () => {
  const auth = await requireAuth();
  requireStandOwner(auth);
  const access = accessFor(auth);
  const items = sessionHistory(auth, access.limits.historySessions);

  let stats = null;
  if (access.isPremium) {
    const s = one<{ completed: number; ended_early: number; cancelled: number; secs: number; avg_secs: number | null; longest: number | null }>(
      `SELECT COALESCE(SUM(status = 'completed'), 0) AS completed,
              COALESCE(SUM(status = 'ended_early'), 0) AS ended_early,
              COALESCE(SUM(status = 'cancelled'), 0) AS cancelled,
              COALESCE(SUM(CASE WHEN status IN ('completed', 'ended_early') THEN focused_seconds END), 0) AS secs,
              AVG(CASE WHEN status IN ('completed', 'ended_early') THEN focused_seconds END) AS avg_secs,
              MAX(CASE WHEN status IN ('completed', 'ended_early') THEN focused_seconds END) AS longest
         FROM pomodoro_sessions WHERE user_id = ? AND kind = 'focus'`,
      auth.user.id,
    )!;
    const finished = s.completed + s.ended_early + s.cancelled;
    stats = {
      completedSessions: s.completed,
      endedEarly: s.ended_early,
      cancelled: s.cancelled,
      totalFocusMinutes: Math.round(s.secs / 60),
      averageMinutes: s.avg_secs ? Math.round(s.avg_secs / 60) : 0,
      longestMinutes: s.longest ? Math.round(s.longest / 60) : 0,
      completionRate: finished ? Math.round((s.completed / finished) * 100) : null,
    };
  }
  return ok({ items, limit: access.limits.historySessions, stats });
});
