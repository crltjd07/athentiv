// Daily rollups, streaks, achievements and notifications — all derived from stored records.
import { all, one, run } from "./db";
import type { Auth } from "./auth";
import { premiumOf } from "./access";
import { addDays, dayOf, dayStart } from "@/shared/day";
import { ACHIEVEMENTS, type AchievementKey } from "@/shared/achievements";
import { TIME } from "@/shared/limits";

/** Recomputes the rollup row for one local day from the raw tables (idempotent). */
export async function recomputeDay(userId: number, tz: string, day: string) {
  const start = dayStart(tz, day);
  const end = dayStart(tz, addDays(day, 1));
  const focus = (await one<{ secs: number; n: number }>(
    `SELECT COALESCE(SUM(focused_seconds), 0) AS secs, COALESCE(SUM(status = 'completed'), 0) AS n
       FROM pomodoro_sessions
      WHERE user_id = ? AND kind = 'focus' AND status IN ('completed', 'ended_early') AND ended_at >= ? AND ended_at < ?`,
    userId, start, end,
  ))!;
  const done = (await one<{ n: number }>(
    "SELECT COUNT(*) AS n FROM tasks WHERE user_id = ? AND completed_at >= ? AND completed_at < ?", userId, start, end,
  ))!.n;
  const created = (await one<{ n: number }>(
    "SELECT COUNT(*) AS n FROM tasks WHERE user_id = ? AND created_at >= ? AND created_at < ?", userId, start, end,
  ))!.n;
  const checkins = (await one<{ n: number }>(
    "SELECT COUNT(*) AS n FROM mood_checkins WHERE user_id = ? AND created_at >= ? AND created_at < ?", userId, start, end,
  ))!.n;
  const minutes = Math.round(focus.secs / 60);
  if (!minutes && !focus.n && !done && !created && !checkins) {
    await run("DELETE FROM daily_productivity_summaries WHERE user_id = ? AND day = ?", userId, day);
    return;
  }
  await run(
    `INSERT INTO daily_productivity_summaries (user_id, day, focus_minutes, focus_sessions, tasks_completed, tasks_created, checkins, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT (user_id, day) DO UPDATE SET
       focus_minutes = excluded.focus_minutes, focus_sessions = excluded.focus_sessions,
       tasks_completed = excluded.tasks_completed, tasks_created = excluded.tasks_created,
       checkins = excluded.checkins, updated_at = excluded.updated_at`,
    userId, day, minutes, focus.n, done, created, checkins, Date.now(),
  );
}

export async function recomputeAt(userId: number, tz: string, ...instants: (number | null | undefined)[]) {
  const days = new Set(instants.filter((t): t is number => typeof t === "number").map((t) => dayOf(tz, t)));
  for (const d of days) await recomputeDay(userId, tz, d);
}

/** Rebuilds every rollup row — used after the user changes time zone. */
export async function rebuildRollups(userId: number, tz: string) {
  await run("DELETE FROM daily_productivity_summaries WHERE user_id = ?", userId);
  const instants = (await all<{ t: number }>(
    `SELECT ended_at AS t FROM pomodoro_sessions WHERE user_id = ? AND kind = 'focus' AND ended_at IS NOT NULL
     UNION SELECT completed_at FROM tasks WHERE user_id = ? AND completed_at IS NOT NULL
     UNION SELECT created_at FROM tasks WHERE user_id = ?
     UNION SELECT created_at FROM mood_checkins WHERE user_id = ?`,
    userId, userId, userId, userId,
  )).map((r) => r.t);
  await recomputeAt(userId, tz, ...instants);
}

/** A study day is any day with a completed task or recorded focus time. */
export async function streakOf(userId: number, tz: string, now = Date.now()) {
  const days = (await all<{ day: string }>(
    `SELECT day FROM daily_productivity_summaries
      WHERE user_id = ? AND (tasks_completed > 0 OR focus_minutes > 0)
      ORDER BY day DESC LIMIT 400`,
    userId,
  )).map((r) => r.day);
  const set = new Set(days);
  const today = dayOf(tz, now);
  let cursor = set.has(today) ? today : addDays(today, -1);
  let current = 0;
  while (set.has(cursor)) {
    current++;
    cursor = addDays(cursor, -1);
  }
  let best = 0;
  let streak = 0;
  let prev: string | null = null;
  for (const d of [...days].reverse()) {
    streak = prev && addDays(prev, 1) === d ? streak + 1 : 1;
    best = Math.max(best, streak);
    prev = d;
  }
  return { current, best, activeToday: set.has(today) };
}

export async function notify(userId: number, n: { kind: string; title: string; body: string; link?: string; dedupe: string }) {
  await run(
    `INSERT OR IGNORE INTO user_notifications (user_id, kind, title, body, link, dedupe_key, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    userId, n.kind, n.title, n.body, n.link ?? null, n.dedupe, Date.now(),
  );
}

/** Unlocks any newly earned achievements and notifies the user about them. */
export async function checkAchievements(userId: number, tz: string, standOwner: boolean) {
  const have = new Set((await all<{ key: string }>("SELECT key FROM user_achievements WHERE user_id = ?", userId)).map((r) => r.key));
  const pending = ACHIEVEMENTS.filter((a) => !have.has(a.key) && (standOwner || !a.standOnly));
  if (!pending.length) return;

  const c = (await one<{ created: number; completed: number; early: number }>(
    `SELECT COUNT(*) AS created,
            COALESCE(SUM(status = 'completed'), 0) AS completed,
            COALESCE(SUM(status = 'completed' AND completed_at <= due_at - 86400000), 0) AS early
       FROM tasks WHERE user_id = ?`,
    userId,
  ))!;
  const f = (await one<{ sessions: number; secs: number }>(
    `SELECT COALESCE(SUM(status = 'completed'), 0) AS sessions, COALESCE(SUM(focused_seconds), 0) AS secs
       FROM pomodoro_sessions WHERE user_id = ? AND kind = 'focus' AND status IN ('completed', 'ended_early')`,
    userId,
  ))!;
  const checkins = (await one<{ n: number }>("SELECT COUNT(*) AS n FROM mood_checkins WHERE user_id = ?", userId))!.n;
  const { best } = await streakOf(userId, tz);

  const earned: Record<AchievementKey, boolean> = {
    first_task: c.created >= 1,
    tasks_10: c.completed >= 10,
    tasks_50: c.completed >= 50,
    early_bird: c.early >= 5,
    streak_3: best >= 3,
    streak_7: best >= 7,
    first_focus: f.sessions >= 1,
    focus_25: f.sessions >= 25,
    hours_10: f.secs >= 36_000,
    checkin_7: checkins >= 7,
  };
  const now = Date.now();
  for (const a of pending) {
    if (!earned[a.key]) continue;
    const r = await run("INSERT OR IGNORE INTO user_achievements (user_id, key, unlocked_at) VALUES (?, ?, ?)", userId, a.key, now);
    if (r.changes) {
      await notify(userId, { kind: "achievement", title: `Achievement unlocked: ${a.title}`, body: a.desc + " — nicely done!", link: "/profile/achievements", dedupe: `ach:${a.key}` });
    }
  }
}

function fmtWhen(tz: string, at: number) {
  return new Intl.DateTimeFormat("en-PH", { timeZone: tz, weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(at);
}

const lastSweep = new Map<number, number>();

/** Generates due-soon, overdue, subscription and daily-summary notifications (idempotent). */
export async function sweepNotifications(auth: Auth, force = false) {
  const { user, tz, now } = auth;
  if (!force && (lastSweep.get(user.id) ?? 0) > now - 2 * TIME.MINUTE) return;
  lastSweep.set(user.id, now);

  const prefs = await one<{
    deadline_reminders: number; reminder_lead_hours: number; overdue_alerts: number; daily_summary: number; subscription_alerts: number;
  }>("SELECT * FROM user_preferences WHERE user_id = ?", user.id);
  if (!prefs) return;

  if (prefs.deadline_reminders) {
    const soon = await all<{ id: number; title: string; due_at: number }>(
      `SELECT id, title, due_at FROM tasks WHERE user_id = ? AND status != 'completed' AND due_at > ? AND due_at <= ?`,
      user.id, now, now + prefs.reminder_lead_hours * TIME.HOUR,
    );
    for (const t of soon) {
      await notify(user.id, { kind: "deadline", title: `Due soon: ${t.title}`, body: `Due ${fmtWhen(tz, t.due_at)}.`, link: `/tasks/${t.id}`, dedupe: `due:${t.id}:${t.due_at}` });
    }
  }
  if (prefs.overdue_alerts) {
    const late = await all<{ id: number; title: string; due_at: number }>(
      `SELECT id, title, due_at FROM tasks WHERE user_id = ? AND status != 'completed' AND due_at <= ? AND due_at > ?`,
      user.id, now, now - 14 * TIME.DAY,
    );
    for (const t of late) {
      await notify(user.id, { kind: "overdue", title: `Overdue: ${t.title}`, body: `This was due ${fmtWhen(tz, t.due_at)}. Finish it or update the deadline.`, link: `/tasks/${t.id}`, dedupe: `overdue:${t.id}:${t.due_at}` });
    }
  }
  if (prefs.subscription_alerts) {
    const p = await premiumOf(user.id, now);
    if (p.active && p.until && p.until - now <= 3 * TIME.DAY) {
      await notify(user.id, { kind: "subscription", title: "Premium is ending soon", body: `Your Premium access ends ${fmtWhen(tz, p.until)}. Your data stays safe either way.`, link: "/premium", dedupe: `prem-exp:${p.until}` });
    }
    if (!p.active && p.lastEndedAt && now - p.lastEndedAt < 14 * TIME.DAY) {
      await notify(user.id, { kind: "subscription", title: "Premium has ended", body: "You're back on Freemium. All your tasks and history are kept — renew any time to unlock everything again.", link: "/premium", dedupe: `prem-end:${p.lastEndedAt}` });
    }
  }
  if (prefs.daily_summary) {
    const yesterday = addDays(dayOf(tz, now), -1);
    const y = await one<{ focus_minutes: number; tasks_completed: number }>(
      "SELECT focus_minutes, tasks_completed FROM daily_productivity_summaries WHERE user_id = ? AND day = ?", user.id, yesterday,
    );
    if (y && (y.focus_minutes > 0 || y.tasks_completed > 0)) {
      const parts = [];
      if (y.focus_minutes > 0) parts.push(`focused for ${y.focus_minutes} min`);
      if (y.tasks_completed > 0) parts.push(`completed ${y.tasks_completed} task${y.tasks_completed === 1 ? "" : "s"}`);
      await notify(user.id, { kind: "summary", title: "Yesterday's recap", body: `You ${parts.join(" and ")}. Keep it going today!`, link: "/summary", dedupe: `daily:${yesterday}` });
    }
  }
}
