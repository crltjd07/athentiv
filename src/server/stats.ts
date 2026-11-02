// Summary analytics, insights and recommendations. Every figure comes from stored records;
// an insight is only produced when the data behind it exists.
import { all, one } from "./db";
import type { Auth } from "./auth";
import { accessFor } from "./access";
import { streakOf } from "./activity";
import { serializeTask, TASK_SELECT, type TaskRow } from "./tasks";
import { addDays, dayOf, dayStart, daysBetween, eachDay, monthStartOf, weekStartOf } from "@/shared/day";
import { moodOf, MOODS, taskTypeLabel } from "@/shared/catalog";
import { TIME } from "@/shared/limits";

type DayRow = { day: string; focus_minutes: number; focus_sessions: number; tasks_completed: number; tasks_created: number; checkins: number };

function rollups(userId: number, from: string, to: string) {
  const rows = all<DayRow>(
    "SELECT * FROM daily_productivity_summaries WHERE user_id = ? AND day >= ? AND day <= ? ORDER BY day", userId, from, to,
  );
  const map = new Map(rows.map((r) => [r.day, r]));
  return eachDay(from, to).map((day) => {
    const r = map.get(day);
    return {
      day,
      focusMinutes: r?.focus_minutes ?? 0,
      focusSessions: r?.focus_sessions ?? 0,
      tasksCompleted: r?.tasks_completed ?? 0,
      tasksCreated: r?.tasks_created ?? 0,
      checkins: r?.checkins ?? 0,
    };
  });
}

function totals(days: ReturnType<typeof rollups>) {
  return days.reduce(
    (a, d) => ({
      focusMinutes: a.focusMinutes + d.focusMinutes,
      focusSessions: a.focusSessions + d.focusSessions,
      tasksCompleted: a.tasksCompleted + d.tasksCompleted,
      tasksCreated: a.tasksCreated + d.tasksCreated,
      checkins: a.checkins + d.checkins,
    }),
    { focusMinutes: 0, focusSessions: 0, tasksCompleted: 0, tasksCreated: 0, checkins: 0 },
  );
}

function dueStats(userId: number, start: number, end: number, now: number) {
  const r = one<{ due: number; done: number; missed: number }>(
    `SELECT COUNT(*) AS due,
            COALESCE(SUM(status = 'completed'), 0) AS done,
            COALESCE(SUM((status = 'completed' AND completed_at > due_at) OR (status != 'completed' AND due_at < ?)), 0) AS missed
       FROM tasks WHERE user_id = ? AND due_at >= ? AND due_at < ?`,
    now, userId, start, end,
  )!;
  return { due: r.due, done: r.done, missed: r.missed, completionRate: r.due ? Math.round((r.done / r.due) * 100) : null };
}

const weekdayName = (day: string) =>
  new Date(day + "T12:00:00Z").toLocaleDateString("en-PH", { weekday: "long", timeZone: "UTC" });

export type RangeInput = { range: "week" | "month" | "custom"; from?: string; to?: string };

export function resolveRange(auth: Auth, input: RangeInput) {
  const today = dayOf(auth.tz, auth.now);
  if (input.range === "custom" && input.from && input.to) {
    const from = input.from <= input.to ? input.from : input.to;
    let to = input.from <= input.to ? input.to : input.from;
    if (daysBetween(from, to) > 366) to = addDays(from, 366);
    return { from, to, label: "Custom range" };
  }
  if (input.range === "month") {
    const from = monthStartOf(today);
    return { from, to: today, label: "This month" };
  }
  return { from: weekStartOf(today), to: addDays(weekStartOf(today), 6), label: "This week" };
}

export function summary(auth: Auth, input: RangeInput) {
  const access = accessFor(auth);
  const advanced = access.features.advancedSummary;
  const { user, tz, now } = auth;
  const range = resolveRange(auth, advanced ? input : { range: "week" });
  const start = dayStart(tz, range.from);
  const end = dayStart(tz, addDays(range.to, 1));
  const length = daysBetween(range.from, range.to) + 1;

  const daily = rollups(user.id, range.from, range.to);
  const t = totals(daily);
  const due = dueStats(user.id, start, end, now);
  const open = one<{ pending: number; overdue: number }>(
    `SELECT COALESCE(SUM(due_at >= ?), 0) AS pending, COALESCE(SUM(due_at < ?), 0) AS overdue
       FROM tasks WHERE user_id = ? AND status != 'completed'`,
    now, now, user.id,
  )!;
  const goal = one<{ daily_goal_minutes: number }>("SELECT daily_goal_minutes FROM user_profiles WHERE user_id = ?", user.id)!.daily_goal_minutes;

  const overview = {
    focusMinutes: t.focusMinutes,
    focusSessions: t.focusSessions,
    tasksCompleted: t.tasksCompleted,
    tasksCreated: t.tasksCreated,
    pendingTasks: open.pending,
    overdueTasks: open.overdue,
    dueInRange: due.due,
    completionRate: due.completionRate,
    missedDeadlines: due.missed,
    goalDays: daily.filter((d) => d.focusMinutes >= goal).length,
  };

  const activeDays = daily.filter((d) => d.focusMinutes > 0 || d.tasksCompleted > 0);
  const best = activeDays.length
    ? activeDays.reduce((a, b) => (b.focusMinutes * 2 + b.tasksCompleted * 30 > a.focusMinutes * 2 + a.tasksCompleted * 30 ? b : a))
    : null;

  const upcoming = all<TaskRow>(
    `${TASK_SELECT} WHERE t.user_id = ? AND t.status != 'completed' AND t.due_at >= ? ORDER BY t.due_at LIMIT 5`, user.id, now,
  ).map((r) => serializeTask(r, now));

  const result = {
    tier: advanced ? ("advanced" as const) : ("basic" as const),
    range: { ...range, days: length },
    goalMinutes: goal,
    overview,
    daily,
    bestDay: best && { day: best.day, weekday: weekdayName(best.day), focusMinutes: best.focusMinutes, tasksCompleted: best.tasksCompleted },
    upcoming,
    streak: streakOf(user.id, tz, now),
    previous: null as null | { from: string; to: string; overview: ReturnType<typeof totals> & { completionRate: number | null } },
    subjectFocus: [] as { subjectId: number | null; name: string; color: string; minutes: number }[],
    subjectProgress: [] as { subjectId: number | null; name: string; color: string; total: number; completed: number; open: number; overdue: number }[],
    typeDistribution: [] as { type: string; label: string; count: number }[],
    mood: null as null | ReturnType<typeof moodInsights>,
    insights: [] as string[],
  };

  if (advanced) {
    const prevTo = addDays(range.from, -1);
    const prevFrom = addDays(prevTo, -(length - 1));
    const prevStart = dayStart(tz, prevFrom);
    result.previous = {
      from: prevFrom,
      to: prevTo,
      overview: { ...totals(rollups(user.id, prevFrom, prevTo)), completionRate: dueStats(user.id, prevStart, start, now).completionRate },
    };

    result.subjectFocus = all<{ subject_id: number | null; name: string | null; color: string | null; secs: number }>(
      `SELECT s.id AS subject_id, s.name, s.color, SUM(p.focused_seconds) AS secs
         FROM pomodoro_sessions p
         LEFT JOIN tasks t ON t.id = p.task_id
         LEFT JOIN subjects s ON s.id = t.subject_id
        WHERE p.user_id = ? AND p.kind = 'focus' AND p.status IN ('completed', 'ended_early') AND p.ended_at >= ? AND p.ended_at < ?
        GROUP BY s.id ORDER BY secs DESC`,
      user.id, start, end,
    )
      .map((r) => ({ subjectId: r.subject_id, name: r.name ?? "General study", color: r.color ?? "#94A3B8", minutes: Math.round(r.secs / 60) }))
      .filter((r) => r.minutes > 0);

    result.subjectProgress = all<{ subject_id: number | null; name: string | null; color: string | null; total: number; completed: number; open_: number; overdue: number }>(
      `SELECT s.id AS subject_id, s.name, s.color, COUNT(*) AS total,
              SUM(t.status = 'completed') AS completed,
              SUM(t.status != 'completed') AS open_,
              SUM(t.status != 'completed' AND t.due_at < ?) AS overdue
         FROM tasks t LEFT JOIN subjects s ON s.id = t.subject_id
        WHERE t.user_id = ? AND (t.due_at >= ? AND t.due_at < ? OR t.status != 'completed')
        GROUP BY s.id ORDER BY total DESC`,
      now, user.id, start, end,
    ).map((r) => ({ subjectId: r.subject_id, name: r.name ?? "No subject", color: r.color ?? "#94A3B8", total: r.total, completed: r.completed, open: r.open_, overdue: r.overdue }));

    result.typeDistribution = all<{ type: string; n: number }>(
      "SELECT type, COUNT(*) AS n FROM tasks WHERE user_id = ? AND due_at >= ? AND due_at < ? GROUP BY type ORDER BY n DESC",
      user.id, start, end,
    ).map((r) => ({ type: r.type, label: taskTypeLabel(r.type), count: r.n }));

    if (access.features.moodHistory) result.mood = moodInsights(user.id, tz, range.from, range.to, daily);
  }

  result.insights = buildInsights(result, access.standOwner, range.label.toLowerCase());
  return result;
}

export function moodInsights(userId: number, tz: string, from: string, to: string, daily: { day: string; focusMinutes: number }[]) {
  const rows = all<{ mood: string; mindset: string; created_at: number }>(
    "SELECT mood, mindset, created_at FROM mood_checkins WHERE user_id = ? AND created_at >= ? AND created_at < ? ORDER BY created_at",
    userId, dayStart(tz, from), dayStart(tz, addDays(to, 1)),
  );
  const distribution = MOODS.map((m) => ({ mood: m.key, label: m.label, emoji: m.emoji, color: m.color, count: rows.filter((r) => r.mood === m.key).length }));
  const byDay = new Map<string, string[]>();
  for (const r of rows) {
    const d = dayOf(tz, r.created_at);
    byDay.set(d, [...(byDay.get(d) ?? []), r.mood]);
  }
  const dailyMood = eachDay(from, to).map((day) => {
    const moods = byDay.get(day) ?? [];
    if (!moods.length) return { day, score: null, mood: null };
    const score = moods.reduce((a, m) => a + moodOf(m).score, 0) / moods.length;
    return { day, score: Math.round(score * 10) / 10, mood: moods[moods.length - 1] };
  });
  const focusByDay = new Map(daily.map((d) => [d.day, d.focusMinutes]));
  const byMood = MOODS.map((m) => {
    const days = dailyMood.filter((d) => d.mood === m.key).map((d) => d.day);
    const avg = days.length ? Math.round(days.reduce((a, d) => a + (focusByDay.get(d) ?? 0), 0) / days.length) : null;
    return { mood: m.key, label: m.label, emoji: m.emoji, days: days.length, avgFocusMinutes: avg };
  }).filter((m) => m.days > 0);
  return { total: rows.length, distribution, daily: dailyMood, byMood };
}

function buildInsights(s: ReturnType<typeof summary>, standOwner: boolean, period: string): string[] {
  const out: string[] = [];
  const o = s.overview;
  if (standOwner && o.focusSessions > 0) {
    out.push(`You completed ${o.focusSessions} focus session${o.focusSessions === 1 ? "" : "s"} ${period}, for ${o.focusMinutes} minutes of focus.`);
  }
  if (o.tasksCompleted > 0) out.push(`You completed ${o.tasksCompleted} task${o.tasksCompleted === 1 ? "" : "s"} ${period}.`);
  const totalFocus = s.subjectFocus.reduce((a, x) => a + x.minutes, 0);
  if (s.subjectFocus.length > 1 && totalFocus > 0) {
    const top = s.subjectFocus[0];
    out.push(`${top.name} accounted for most of your recorded study time (${Math.round((top.minutes / totalFocus) * 100)}%).`);
  }
  if (s.previous) {
    const prev = s.previous.overview.tasksCompleted;
    if (o.tasksCompleted > prev) out.push(`You completed more tasks than in the previous period (${o.tasksCompleted} vs ${prev}).`);
    else if (o.tasksCompleted < prev && prev > 0) out.push(`You completed fewer tasks than in the previous period (${o.tasksCompleted} vs ${prev}).`);
    const pf = s.previous.overview.focusMinutes;
    if (standOwner && pf > 0 && o.focusMinutes !== pf) {
      const change = Math.round(((o.focusMinutes - pf) / pf) * 100);
      out.push(`Your focus time is ${change > 0 ? "up" : "down"} ${Math.abs(change)}% compared with the previous period.`);
    }
  }
  if (s.bestDay && (s.bestDay.focusMinutes > 0 || s.bestDay.tasksCompleted > 0)) {
    const bits = [];
    if (s.bestDay.focusMinutes) bits.push(`${s.bestDay.focusMinutes} min focused`);
    if (s.bestDay.tasksCompleted) bits.push(`${s.bestDay.tasksCompleted} task${s.bestDay.tasksCompleted === 1 ? "" : "s"} done`);
    out.push(`Your most productive day was ${s.bestDay.weekday} (${bits.join(", ")}).`);
  }
  if (o.overdueTasks > 0) out.push(`${o.overdueTasks} task${o.overdueTasks === 1 ? " is" : "s are"} overdue. Updating or finishing ${o.overdueTasks === 1 ? "it" : "them"} will clear your list.`);
  if (o.missedDeadlines > 0) out.push(`${o.missedDeadlines} deadline${o.missedDeadlines === 1 ? " was" : "s were"} missed in this period.`);
  if (standOwner && o.goalDays > 0) out.push(`You reached your daily focus goal on ${o.goalDays} day${o.goalDays === 1 ? "" : "s"}.`);
  if (s.mood && s.mood.byMood.length >= 2) {
    const ranked = s.mood.byMood.filter((m) => m.avgFocusMinutes !== null).sort((a, b) => b.avgFocusMinutes! - a.avgFocusMinutes!);
    if (ranked.length >= 2 && ranked[0].avgFocusMinutes! > ranked[ranked.length - 1].avgFocusMinutes!) {
      out.push(`On days you checked in feeling ${ranked[0].label.toLowerCase()}, you focused ${ranked[0].avgFocusMinutes} min on average — your highest.`);
    }
  }
  if (s.streak.current >= 2) out.push(`You're on a ${s.streak.current}-day study streak.`);
  return out;
}

// ---------------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------------

export function dashboard(auth: Auth) {
  const access = accessFor(auth);
  const { user, tz, now } = auth;
  const today = dayOf(tz, now);
  const todayStart = dayStart(tz, today);
  const tomorrowStart = dayStart(tz, addDays(today, 1));
  const roll = rollups(user.id, today, today)[0];
  const goal = one<{ daily_goal_minutes: number }>("SELECT daily_goal_minutes FROM user_profiles WHERE user_id = ?", user.id)!.daily_goal_minutes;

  const open = all<TaskRow>(`${TASK_SELECT} WHERE t.user_id = ? AND t.status != 'completed' ORDER BY t.due_at`, user.id).map((r) => serializeTask(r, now));
  const dueToday = all<TaskRow>(
    `${TASK_SELECT} WHERE t.user_id = ? AND t.due_at >= ? AND t.due_at < ? ORDER BY t.status = 'completed', t.due_at`,
    user.id, todayStart, tomorrowStart,
  ).map((r) => serializeTask(r, now));
  const lastCheckin = access.standOwner
    ? one<{ mood: string; mindset: string; created_at: number }>(
        "SELECT mood, mindset, created_at FROM mood_checkins WHERE user_id = ? AND created_at >= ? ORDER BY created_at DESC LIMIT 1",
        user.id, todayStart,
      )
    : undefined;
  const totalTasks = one<{ n: number }>("SELECT COUNT(*) AS n FROM tasks WHERE user_id = ?", user.id)!.n;

  return {
    today: {
      day: today,
      focusMinutes: roll.focusMinutes,
      focusSessions: roll.focusSessions,
      goalMinutes: goal,
      tasksCompleted: roll.tasksCompleted,
      tasksDue: dueToday.length,
      tasksDueDone: dueToday.filter((t) => t.status === "completed").length,
    },
    streak: streakOf(user.id, tz, now),
    openCount: open.length,
    overdueCount: open.filter((t) => t.status === "overdue").length,
    upcoming: open.slice(0, 5),
    dueToday,
    checkin: lastCheckin ? { mood: lastCheckin.mood, mindset: lastCheckin.mindset, at: lastCheckin.created_at } : null,
    recommendations: recommendations(access.standOwner, open, lastCheckin?.mood ?? null, totalTasks, now),
  };
}

type Rec = { id: string; text: string; action?: { label: string; href: string } };

function recommendations(standOwner: boolean, open: ReturnType<typeof serializeTask>[], mood: string | null, totalTasks: number, now: number): Rec[] {
  const recs: Rec[] = [];
  if (totalTasks === 0) {
    recs.push({ id: "first-task", text: "Add your first assignment so FocusDock can keep track of your deadlines.", action: { label: "Add task", href: "/tasks/new" } });
    return recs;
  }
  const overdue = open.filter((t) => t.status === "overdue");
  if (overdue.length) {
    const t = overdue[0];
    recs.push({
      id: "overdue",
      text: overdue.length === 1 ? `"${t.title}" is past its deadline. Finish it or set a new date.` : `You have ${overdue.length} overdue tasks. Start with "${t.title}".`,
      action: { label: "Review", href: `/tasks/${t.id}` },
    });
  }
  const exam = open.find((t) => (t.type === "exam" || t.type === "quiz") && t.status !== "overdue" && t.dueAt - now < 3 * TIME.DAY);
  if (exam) {
    const days = Math.max(0, Math.round((exam.dueAt - now) / TIME.DAY));
    const when = days === 0 ? "today" : days === 1 ? "tomorrow" : `in ${days} days`;
    const what = `${exam.subject ? exam.subject.name + " " : ""}${taskTypeLabel(exam.type).toLowerCase()}`;
    recs.push(
      standOwner && exam.focusMinutes === 0
        ? { id: "exam-focus", text: `Your ${what} is ${when} and has no focus time yet. A 25-minute session is a great start.`, action: { label: "Focus now", href: `/focus?task=${exam.id}` } }
        : { id: "exam-plan", text: `Your ${what} is ${when}. Break your review into checklist steps.`, action: { label: "Open", href: `/tasks/${exam.id}` } },
    );
  }
  if (mood === "stressed" || mood === "tired" || mood === "unmotivated") {
    const small = open.find((t) => t.effort === "S" && t.status !== "overdue");
    if (small) recs.push({ id: "mood-small", text: `You checked in feeling ${moodOf(mood).label.toLowerCase()}. A quick win like "${small.title}" can build momentum.`, action: { label: "Open", href: `/tasks/${small.id}` } });
  }
  const bySubject = new Map<string, number>();
  for (const t of open) if (t.subject) bySubject.set(t.subject.name, (bySubject.get(t.subject.name) ?? 0) + 1);
  const busiest = [...bySubject.entries()].sort((a, b) => b[1] - a[1])[0];
  if (busiest && busiest[1] >= 2) recs.push({ id: "subject", text: `${busiest[0]} has ${busiest[1]} unfinished tasks — it's your busiest subject right now.`, action: { label: "View tasks", href: "/tasks" } });
  return recs.slice(0, 3);
}
