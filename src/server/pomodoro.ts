// Pomodoro engine. The database stores only timestamps; remaining time is always derived from
// them, so the timer survives refreshes and closed tabs without per-second writes.
import { all, one, run, tx } from "./db";
import { err } from "./http";
import type { Auth } from "./auth";
import { premiumOf, requireNfc, requirePremium, requireStandOwner } from "./access";
import { checkAchievements, recomputeAt } from "./activity";
import { changeStatus, getOwnedTask } from "./tasks";
import { LIMITS } from "@/shared/limits";
import { addDays, dayOf, dayStart } from "@/shared/day";
import type { PresetKey } from "@/shared/catalog";

type PomoRow = {
  id: number;
  user_id: number;
  task_id: number | null;
  focus_session_id: number | null;
  kind: "focus" | "break";
  preset: PresetKey;
  planned_seconds: number;
  planned_break_seconds: number | null;
  started_at: number;
  paused_at: number | null;
  paused_total_ms: number;
  ended_at: number | null;
  status: "active" | "paused" | "completed" | "ended_early" | "cancelled" | "skipped";
  end_reason: string | null;
  focused_seconds: number | null;
  extensions: number;
  created_at: number;
};

type ConfigRow = {
  user_id: number;
  preset: PresetKey;
  custom_focus_minutes: number;
  custom_break_minutes: number;
  auto_start_break: number;
  daily_goal_sessions: number;
};

export function getConfig(userId: number): ConfigRow {
  run("INSERT OR IGNORE INTO pomodoro_configurations (user_id, updated_at) VALUES (?, ?)", userId, Date.now());
  return one<ConfigRow>("SELECT * FROM pomodoro_configurations WHERE user_id = ?", userId)!;
}

function activeElapsedMs(s: PomoRow, at: number) {
  return at - s.started_at - s.paused_total_ms - (s.paused_at ? at - s.paused_at : 0);
}

function remainingMs(s: PomoRow, at: number) {
  return Math.max(0, s.planned_seconds * 1000 - activeElapsedMs(s, at));
}

function liveRow(userId: number) {
  return one<PomoRow>("SELECT * FROM pomodoro_sessions WHERE user_id = ? AND status IN ('active', 'paused')", userId);
}

function startBreak(userId: number, focus: PomoRow, at: number) {
  const seconds = focus.planned_break_seconds ?? 300;
  run(
    `INSERT INTO pomodoro_sessions (user_id, task_id, focus_session_id, kind, preset, planned_seconds, started_at, status, created_at)
     VALUES (?, ?, ?, 'break', ?, ?, ?, 'active', ?)`,
    userId, focus.task_id, focus.id, focus.preset, seconds, at, Date.now(),
  );
}

function finishFocus(auth: Auth, s: PomoRow, endedAt: number, status: "completed" | "ended_early", reason: string) {
  const focused = Math.max(0, Math.min(s.planned_seconds, Math.floor(activeElapsedMs(s, endedAt) / 1000)));
  run(
    `UPDATE pomodoro_sessions SET status = ?, end_reason = ?, ended_at = ?, focused_seconds = ?,
            paused_total_ms = paused_total_ms + CASE WHEN paused_at IS NULL THEN 0 ELSE ? - paused_at END, paused_at = NULL
      WHERE id = ?`,
    status, reason, endedAt, focused, endedAt, s.id,
  );
  recomputeAt(auth.user.id, auth.tz, endedAt);
  checkAchievements(auth.user.id, auth.tz, true);
  if (getConfig(auth.user.id).auto_start_break) startBreak(auth.user.id, s, endedAt);
}

function endBreak(s: PomoRow, endedAt: number, status: "completed" | "skipped", reason: string) {
  run(
    "UPDATE pomodoro_sessions SET status = ?, end_reason = ?, ended_at = ?, paused_at = NULL WHERE id = ?",
    status, reason, endedAt, s.id,
  );
}

function cancelSession(auth: Auth, s: PomoRow, endedAt: number, reason: string) {
  const focused = s.kind === "focus" ? Math.max(0, Math.floor(activeElapsedMs(s, endedAt) / 1000)) : null;
  run(
    "UPDATE pomodoro_sessions SET status = ?, end_reason = ?, ended_at = ?, focused_seconds = ?, paused_at = NULL WHERE id = ?",
    s.kind === "focus" ? "cancelled" : "skipped", reason, endedAt, focused, s.id,
  );
}

/**
 * Brings the user's live session up to date: completes timers that ran out (and chains the
 * break), and cancels sessions paused longer than the 15-minute limit. Returns the live row.
 */
export function settle(auth: Auth): PomoRow | null {
  return tx(() => {
    const now = Date.now();
    for (let guard = 0; guard < 4; guard++) {
      const s = liveRow(auth.user.id);
      if (!s) return null;
      if (s.status === "paused" && s.paused_at && now - s.paused_at > LIMITS.pauseMaxMs) {
        cancelSession(auth, s, s.paused_at + LIMITS.pauseMaxMs, "pause_timeout");
        continue;
      }
      if (s.status === "active" && remainingMs(s, now) <= 0) {
        const endedAt = s.started_at + s.paused_total_ms + s.planned_seconds * 1000;
        if (s.kind === "focus") finishFocus(auth, s, endedAt, "completed", "timer");
        else endBreak(s, endedAt, "completed", "timer");
        continue;
      }
      return s;
    }
    return liveRow(auth.user.id) ?? null;
  });
}

function todayCounts(auth: Auth) {
  const today = dayOf(auth.tz, auth.now);
  const start = dayStart(auth.tz, today);
  const end = dayStart(auth.tz, addDays(today, 1));
  const r = one<{ started: number; completed: number; secs: number }>(
    `SELECT COALESCE(SUM(status != 'cancelled'), 0) AS started,
            COALESCE(SUM(status = 'completed'), 0) AS completed,
            COALESCE(SUM(CASE WHEN status IN ('completed', 'ended_early') THEN focused_seconds ELSE 0 END), 0) AS secs
       FROM pomodoro_sessions WHERE user_id = ? AND kind = 'focus' AND started_at >= ? AND started_at < ?`,
    auth.user.id, start, end,
  )!;
  return { started: r.started, completed: r.completed, focusMinutes: Math.round(r.secs / 60) };
}

export function pomodoroState(auth: Auth) {
  const live = settle(auth);
  const now = Date.now();
  const premium = premiumOf(auth.user.id, now).active;
  const config = getConfig(auth.user.id);
  const counts = todayCounts(auth);
  const limit = premium ? null : LIMITS.freeDailyFocusSessions;

  let task = null;
  const taskId = live?.task_id ?? null;
  if (taskId) {
    const t = one<{ id: number; title: string; subject_name: string | null; subject_color: string | null; subject_icon: string | null; due_at: number; effort: string }>(
      `SELECT t.id, t.title, t.due_at, t.effort, s.name AS subject_name, s.color AS subject_color, s.icon AS subject_icon
         FROM tasks t LEFT JOIN subjects s ON s.id = t.subject_id WHERE t.id = ? AND t.user_id = ?`,
      taskId, auth.user.id,
    );
    if (t) task = { id: t.id, title: t.title, dueAt: t.due_at, effort: t.effort, subject: t.subject_name ? { name: t.subject_name, color: t.subject_color, icon: t.subject_icon } : null };
  }

  const last = live
    ? null
    : one<PomoRow>("SELECT * FROM pomodoro_sessions WHERE user_id = ? ORDER BY started_at DESC, id DESC LIMIT 1", auth.user.id);
  const breakPending =
    !!last && last.kind === "focus" && (last.status === "completed" || last.status === "ended_early") &&
    !!last.ended_at && now - last.ended_at < 30 * 60_000;

  return {
    serverNow: now,
    live: live && {
      id: live.id,
      kind: live.kind,
      status: live.status,
      preset: live.preset,
      plannedSeconds: live.planned_seconds,
      remainingMs: remainingMs(live, now),
      startedAt: live.started_at,
      pausedAt: live.paused_at,
      pauseExpiresInMs: live.paused_at ? Math.max(0, live.paused_at + LIMITS.pauseMaxMs - now) : null,
      extensions: live.extensions,
      canExtend: live.kind === "break" && premium && live.extensions < LIMITS.maxBreakExtensions,
      plannedBreakSeconds: live.planned_break_seconds,
      task,
    },
    last: last && {
      id: last.id,
      kind: last.kind,
      status: last.status,
      endReason: last.end_reason,
      endedAt: last.ended_at,
      focusedSeconds: last.focused_seconds,
      plannedBreakSeconds: last.planned_break_seconds,
      breakPending,
    },
    today: {
      ...counts,
      limit,
      remaining: limit === null ? null : Math.max(0, limit - counts.started),
      goalSessions: config.daily_goal_sessions,
    },
    config: {
      preset: premium ? config.preset : "25/5",
      customFocusMinutes: config.custom_focus_minutes,
      customBreakMinutes: config.custom_break_minutes,
      autoStartBreak: !!config.auto_start_break,
      dailyGoalSessions: config.daily_goal_sessions,
    },
  };
}

export function startFocus(
  auth: Auth,
  input: { preset: PresetKey; focusMinutes?: number; breakMinutes?: number; taskId?: number | null },
) {
  requireNfc(auth);
  return tx(() => {
    if (settle(auth)) throw err.conflict("SESSION_IN_PROGRESS", "You already have a session running.");
    const premium = premiumOf(auth.user.id, auth.now).active;
    const config = getConfig(auth.user.id);

    let focus = 25;
    let brk = 5;
    if (input.preset === "50/10") {
      requirePremium(auth, "The 50/10 preset");
      focus = 50;
      brk = 10;
    } else if (input.preset === "custom") {
      requirePremium(auth, "Custom focus durations");
      focus = input.focusMinutes ?? config.custom_focus_minutes;
      brk = input.breakMinutes ?? config.custom_break_minutes;
    }

    if (!premium) {
      const { started } = todayCounts(auth);
      if (started >= LIMITS.freeDailyFocusSessions) {
        throw err.forbidden(
          "DAILY_LIMIT",
          `Freemium includes ${LIMITS.freeDailyFocusSessions} focus sessions per day. Come back tomorrow or upgrade for unlimited sessions.`,
          { limit: LIMITS.freeDailyFocusSessions },
        );
      }
    }

    let taskId: number | null = null;
    if (input.taskId) {
      const task = getOwnedTask(auth, input.taskId);
      if (task.status === "completed") throw err.badRequest("That task is already completed.");
      taskId = task.id;
      if (task.status === "pending") changeStatus(auth, task, "in_progress", "pomodoro");
    }

    const now = Date.now();
    run(
      `INSERT INTO pomodoro_sessions (user_id, task_id, kind, preset, planned_seconds, planned_break_seconds, started_at, status, created_at)
       VALUES (?, ?, 'focus', ?, ?, ?, ?, 'active', ?)`,
      auth.user.id, taskId, input.preset, focus * 60, brk * 60, now, now,
    );
    run(
      `UPDATE pomodoro_configurations SET preset = ?, custom_focus_minutes = ?, custom_break_minutes = ?, updated_at = ? WHERE user_id = ?`,
      input.preset,
      input.preset === "custom" ? focus : config.custom_focus_minutes,
      input.preset === "custom" ? brk : config.custom_break_minutes,
      now, auth.user.id,
    );
  });
}

export function sessionAction(auth: Auth, id: number, action: string) {
  requireStandOwner(auth);
  tx(() => {
    const now = Date.now();
    if (action === "start_break") {
      if (settle(auth)) throw err.conflict("SESSION_IN_PROGRESS", "A session is already running.");
      const last = one<PomoRow>("SELECT * FROM pomodoro_sessions WHERE id = ? AND user_id = ?", id, auth.user.id);
      const newer = last && one("SELECT 1 FROM pomodoro_sessions WHERE user_id = ? AND started_at > ?", auth.user.id, last.started_at);
      if (!last || last.kind !== "focus" || newer || !["completed", "ended_early"].includes(last.status)) {
        throw err.badRequest("There is no break waiting to start.");
      }
      startBreak(auth.user.id, last, now);
      return;
    }

    const s = settle(auth);
    if (action === "sync") return;
    if (!s || s.id !== id) throw err.conflict("SESSION_ENDED", "This session has already ended.");

    switch (action) {
      case "pause":
        if (s.status !== "active") throw err.badRequest("Session is not running.");
        run("UPDATE pomodoro_sessions SET status = 'paused', paused_at = ? WHERE id = ?", now, s.id);
        break;
      case "resume":
        if (s.status !== "paused" || !s.paused_at) throw err.badRequest("Session is not paused.");
        run(
          "UPDATE pomodoro_sessions SET status = 'active', paused_total_ms = paused_total_ms + ?, paused_at = NULL WHERE id = ?",
          now - s.paused_at, s.id,
        );
        break;
      case "cancel":
        cancelSession(auth, s, now, "user_cancelled");
        break;
      case "end_early":
        if (s.kind !== "focus") throw err.badRequest("Only focus sessions can be ended early.");
        finishFocus(auth, s, now, "ended_early", "user_ended_early");
        break;
      case "skip":
        if (s.kind !== "break") throw err.badRequest("Only breaks can be skipped.");
        endBreak(s, now, "skipped", "user_skipped");
        break;
      case "extend":
        if (s.kind !== "break") throw err.badRequest("Only breaks can be extended.");
        requirePremium(auth, "Extending breaks");
        if (s.extensions >= LIMITS.maxBreakExtensions) throw err.badRequest("This break can't be extended any further.");
        run(
          "UPDATE pomodoro_sessions SET planned_seconds = planned_seconds + ?, extensions = extensions + 1 WHERE id = ?",
          LIMITS.breakExtendSeconds, s.id,
        );
        break;
      default:
        throw err.badRequest("Unknown action.");
    }
  });
}

export function sessionHistory(auth: Auth, limit: number) {
  settle(auth);
  return all<PomoRow & { task_title: string | null; subject_name: string | null; subject_color: string | null }>(
    `SELECT p.*, t.title AS task_title, s.name AS subject_name, s.color AS subject_color
       FROM pomodoro_sessions p
       LEFT JOIN tasks t ON t.id = p.task_id
       LEFT JOIN subjects s ON s.id = t.subject_id
      WHERE p.user_id = ? AND p.kind = 'focus' AND p.status NOT IN ('active', 'paused')
      ORDER BY p.started_at DESC LIMIT ?`,
    auth.user.id, limit,
  ).map((p) => ({
    id: p.id,
    status: p.status,
    preset: p.preset,
    plannedMinutes: Math.round(p.planned_seconds / 60),
    focusedMinutes: Math.round((p.focused_seconds ?? 0) / 60),
    startedAt: p.started_at,
    endedAt: p.ended_at,
    endReason: p.end_reason,
    task: p.task_id ? { id: p.task_id, title: p.task_title, subject: p.subject_name, color: p.subject_color } : null,
  }));
}
