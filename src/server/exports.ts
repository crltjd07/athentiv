import { all, one, run } from "./db";
import { err } from "./http";
import type { Auth } from "./auth";
import { accessFor } from "./access";
import { summary } from "./stats";
import { Pdf } from "./pdf";
import { addDays, dayStart } from "@/shared/day";
import { effortOf, mindsetOf, moodOf, taskTypeLabel } from "@/shared/catalog";
import { derivedStatus } from "./tasks";

export type ExportKind = "tasks" | "pomodoro" | "stats" | "mood" | "full";
export type ExportFormat = "csv" | "pdf";

export const EXPORT_FORMATS: Record<ExportKind, ExportFormat[]> = {
  tasks: ["csv"],
  pomodoro: ["csv"],
  stats: ["pdf", "csv"],
  mood: ["csv"],
  full: ["pdf"],
};

/** Quotes a CSV cell and neutralises spreadsheet formula injection. */
function cell(v: unknown): string {
  let s = v === null || v === undefined ? "" : String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
const csv = (headers: string[], rows: unknown[][]) => "﻿" + [headers, ...rows].map((r) => r.map(cell).join(",")).join("\r\n") + "\r\n";

function stamp(tz: string, at: number | null) {
  if (!at) return "";
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
      .formatToParts(at)
      .map((x) => [x.type, x.value]),
  );
  return `${p.year}-${p.month}-${p.day} ${p.hour}:${p.minute}`;
}

type TaskExportRow = { id: number; title: string; type: string; subject: string | null; due_at: number; effort: string; status: "pending" | "in_progress" | "completed"; description: string | null; created_at: number; completed_at: number | null; focus_secs: number };

function loadTasks(auth: Auth, start: number, end: number) {
  return all<TaskExportRow>(
    `SELECT t.id, t.title, t.type, s.name AS subject, t.due_at, t.effort, t.status, t.description, t.created_at, t.completed_at,
            (SELECT COALESCE(SUM(p.focused_seconds), 0) FROM pomodoro_sessions p WHERE p.task_id = t.id AND p.kind = 'focus' AND p.status IN ('completed', 'ended_early')) AS focus_secs
       FROM tasks t LEFT JOIN subjects s ON s.id = t.subject_id
      WHERE t.user_id = ? AND ((t.due_at >= ? AND t.due_at < ?) OR (t.created_at >= ? AND t.created_at < ?) OR (t.completed_at >= ? AND t.completed_at < ?))
      ORDER BY t.due_at`,
    auth.user.id, start, end, start, end, start, end,
  );
}

function loadSessions(auth: Auth, start: number, end: number) {
  return all<{ id: number; status: string; preset: string; planned_seconds: number; focused_seconds: number | null; started_at: number; ended_at: number | null; task: string | null; subject: string | null }>(
    `SELECT p.id, p.status, p.preset, p.planned_seconds, p.focused_seconds, p.started_at, p.ended_at, t.title AS task, s.name AS subject
       FROM pomodoro_sessions p LEFT JOIN tasks t ON t.id = p.task_id LEFT JOIN subjects s ON s.id = t.subject_id
      WHERE p.user_id = ? AND p.kind = 'focus' AND p.status NOT IN ('active', 'paused') AND p.started_at >= ? AND p.started_at < ?
      ORDER BY p.started_at`,
    auth.user.id, start, end,
  );
}

function loadMood(auth: Auth, start: number, end: number) {
  return all<{ mood: string; mindset: string; intensity: number | null; note: string | null; created_at: number }>(
    "SELECT mood, mindset, intensity, note, created_at FROM mood_checkins WHERE user_id = ? AND created_at >= ? AND created_at < ? ORDER BY created_at",
    auth.user.id, start, end,
  );
}

function loadDaily(auth: Auth, from: string, to: string) {
  return all<{ day: string; focus_minutes: number; focus_sessions: number; tasks_completed: number; tasks_created: number; checkins: number }>(
    "SELECT day, focus_minutes, focus_sessions, tasks_completed, tasks_created, checkins FROM daily_productivity_summaries WHERE user_id = ? AND day >= ? AND day <= ? ORDER BY day",
    auth.user.id, from, to,
  );
}

export async function buildExport(auth: Auth, kind: ExportKind, format: ExportFormat, from: string, to: string) {
  const access = await accessFor(auth);
  const deny = async (code: string, message: string) => {
    await run("INSERT INTO export_requests (user_id, kind, format, range_start, range_end, status, created_at) VALUES (?, ?, ?, ?, ?, 'denied', ?)",
      auth.user.id, kind, format, dayStart(auth.tz, from), dayStart(auth.tz, addDays(to, 1)), Date.now());
    return err.forbidden(code, message);
  };
  if (!access.features.exports) throw await deny("PREMIUM_REQUIRED", "Data exports are a Premium feature.");
  if (!EXPORT_FORMATS[kind].includes(format)) throw err.badRequest(`${format.toUpperCase()} isn't available for this export.`);
  if (kind === "pomodoro" && !access.standOwner) throw await deny("STAND_OWNER_ONLY", "Pomodoro history is only recorded for stand owners.");
  if (kind === "mood" && !access.features.moodHistory) throw await deny("STAND_OWNER_ONLY", "Mood history is available to Premium stand owners only.");

  const { tz, now } = auth;
  const start = dayStart(tz, from);
  const end = dayStart(tz, addDays(to, 1));
  const base = `focusdock-${kind}-${from}-to-${to}`;
  const includeMood = access.features.moodHistory;
  let body: string | Buffer;
  let rows = 0;

  if (kind === "tasks") {
    const tasks = await loadTasks(auth, start, end);
    rows = tasks.length;
    const mapped = tasks.map((t) => ({
      title: t.title, type: taskTypeLabel(t.type), subject: t.subject ?? "", due: stamp(tz, t.due_at), effort: effortOf(t.effort).label,
      status: derivedStatus(t, now), focusMinutes: Math.round(t.focus_secs / 60), created: stamp(tz, t.created_at), completed: stamp(tz, t.completed_at), description: t.description ?? "",
    }));
    body = csv(["Title", "Type", "Subject", "Due", "Effort", "Status", "Focus minutes", "Created", "Completed", "Description"], mapped.map(Object.values));
  } else if (kind === "pomodoro") {
    const s = await loadSessions(auth, start, end);
    rows = s.length;
    const mapped = s.map((p) => ({ started: stamp(tz, p.started_at), ended: stamp(tz, p.ended_at), status: p.status, preset: p.preset, plannedMinutes: Math.round(p.planned_seconds / 60), focusedMinutes: Math.round((p.focused_seconds ?? 0) / 60), task: p.task ?? "General study", subject: p.subject ?? "" }));
    body = csv(["Started", "Ended", "Status", "Preset", "Planned minutes", "Focused minutes", "Task", "Subject"], mapped.map(Object.values));
  } else if (kind === "mood") {
    const m = await loadMood(auth, start, end);
    rows = m.length;
    const mapped = m.map((c) => ({ at: stamp(tz, c.created_at), mood: moodOf(c.mood).label, mindset: mindsetOf(c.mindset).label, intensity: c.intensity ?? "", note: c.note ?? "" }));
    body = csv(["Date", "Mood", "Mindset", "Intensity (1-5)", "Note"], mapped.map(Object.values));
  } else if (kind === "stats" && format !== "pdf") {
    const d = await loadDaily(auth, from, to);
    rows = d.length;
    body = csv(["Day", "Focus minutes", "Focus sessions", "Tasks completed", "Tasks created", "Check-ins"], d.map((r) => [r.day, r.focus_minutes, r.focus_sessions, r.tasks_completed, r.tasks_created, r.checkins]));
  } else {
    // PDF report (stats or full)
    const r = await reportPdf(auth, from, to, kind === "full", access.standOwner, includeMood);
    body = r.buffer;
    rows = r.rows;
  }

  await run(
    "INSERT INTO export_requests (user_id, kind, format, range_start, range_end, status, row_count, created_at) VALUES (?, ?, ?, ?, ?, 'completed', ?, ?)",
    auth.user.id, kind, format, start, end, rows, now,
  );
  const contentType = format === "csv" ? "text/csv; charset=utf-8" : "application/pdf";
  return { filename: `${base}.${format}`, contentType, body };
}

async function reportPdf(auth: Auth, from: string, to: string, full: boolean, standOwner: boolean, includeMood: boolean) {
  const s = await summary(auth, { range: "custom", from, to });
  const name = (await one<{ display_name: string }>("SELECT display_name FROM user_profiles WHERE user_id = ?", auth.user.id))!.display_name;
  const pdf = new Pdf();
  const W = pdf.width - pdf.margin * 2;

  pdf.rect(0, pdf.height - 110, pdf.width, 110, "#1539B0");
  pdf.text(pdf.margin, pdf.height - 52, "ATHENTIV FocusDock", { size: 20, bold: true, color: "#FFFFFF" });
  pdf.text(pdf.margin, pdf.height - 72, "Productivity Report", { size: 12, color: "#DCE6FF" });
  pdf.text(pdf.margin, pdf.height - 92, `${name} (@${auth.user.username})  •  ${from} to ${to}  •  Generated ${stamp(auth.tz, auth.now)} (${auth.tz})`, { size: 9, color: "#DCE6FF" });
  pdf.y = pdf.height - 130;

  pdf.heading("Overview");
  const o = s.overview;
  const tiles: [string, string][] = [
    ...(standOwner ? ([["Focus minutes", String(o.focusMinutes)], ["Focus sessions", String(o.focusSessions)]] as [string, string][]) : []),
    ["Tasks completed", String(o.tasksCompleted)],
    ["Completion rate", o.completionRate === null ? "No tasks" : `${o.completionRate}%`],
    ["Open (pending)", String(o.pendingTasks)],
    ["Overdue now", String(o.overdueTasks)],
    ["Missed deadlines", String(o.missedDeadlines)],
  ];
  const tileW = W / 4;
  tiles.forEach(([label, value], i) => {
    if (i % 4 === 0) {
      pdf.ensure(54);
      pdf.y -= 50;
    }
    const x = pdf.margin + (i % 4) * tileW;
    pdf.rect(x, pdf.y, tileW - 8, 44, "#F1F5FF");
    pdf.text(x + 10, pdf.y + 24, value, { size: 15, bold: true, color: "#1539B0" });
    pdf.text(x + 10, pdf.y + 10, label, { size: 8, color: "#64748B" });
  });
  pdf.y -= 6;

  const metric = standOwner ? "focusMinutes" : "tasksCompleted";
  const days = s.daily.slice(-31);
  const max = Math.max(1, ...days.map((d) => d[metric]));
  pdf.heading(standOwner ? "Daily focus minutes" : "Tasks completed per day");
  pdf.ensure(130);
  const chartH = 90;
  const baseY = pdf.y - chartH - 14;
  const bw = W / days.length;
  days.forEach((d, i) => {
    const h = (d[metric] / max) * chartH;
    if (h > 0) pdf.rect(pdf.margin + i * bw + bw * 0.15, baseY, bw * 0.7, h, "#2F5BEA");
    if (days.length <= 14 || i % Math.ceil(days.length / 10) === 0) pdf.text(pdf.margin + i * bw, baseY - 11, d.day.slice(5), { size: 6.5, color: "#64748B" });
  });
  pdf.rect(pdf.margin, baseY, W, 0.6, "#CBD5E1");
  pdf.text(pdf.margin, baseY + chartH + 4, `max ${max}`, { size: 7, color: "#94A3B8" });
  pdf.y = baseY - 18;

  if (s.subjectFocus.length) {
    pdf.heading("Focus by subject");
    pdf.table(["Subject", "Minutes"], s.subjectFocus.map((x) => [x.name, String(x.minutes)]), [0, 300]);
  }
  if (s.subjectProgress.length) {
    pdf.heading("Progress by subject");
    pdf.table(["Subject", "Total", "Completed", "Open", "Overdue"], s.subjectProgress.map((x) => [x.name, String(x.total), String(x.completed), String(x.open), String(x.overdue)]), [0, 220, 290, 370, 430]);
  }
  if (s.mood && includeMood && s.mood.total) {
    pdf.heading("Mood check-ins");
    pdf.table(["Mood", "Check-ins"], s.mood.distribution.filter((m) => m.count).map((m) => [m.label, String(m.count)]), [0, 300]);
    pdf.paragraph("Mood data is self-reported and shown for personal reflection only. It is not a medical or psychological assessment.", { size: 8, color: "#64748B" });
  }
  if (s.insights.length) {
    pdf.heading("Insights");
    for (const i of s.insights) pdf.paragraph("•  " + i, { size: 10 });
  }

  let rows = s.daily.length;
  if (full) {
    const start = dayStart(auth.tz, from);
    const end = dayStart(auth.tz, addDays(to, 1));
    const tasks = await loadTasks(auth, start, end);
    rows += tasks.length;
    pdf.heading(`Tasks (${tasks.length})`);
    pdf.table(
      ["Title", "Subject", "Due", "Effort", "Status"],
      tasks.map((t) => [t.title, t.subject ?? "None", stamp(auth.tz, t.due_at), effortOf(t.effort).label, derivedStatus(t, auth.now).replace("_", " ")]),
      [0, 160, 300, 388, 448],
    );
    if (standOwner) {
      const sessions = await loadSessions(auth, start, end);
      rows += sessions.length;
      pdf.heading(`Focus sessions (${sessions.length})`);
      pdf.table(
        ["Started", "Task", "Focused", "Status"],
        sessions.map((p) => [stamp(auth.tz, p.started_at), p.task ?? "General study", `${Math.round((p.focused_seconds ?? 0) / 60)} min`, p.status.replace("_", " ")]),
        [0, 110, 340, 410],
      );
    }
  }
  return { buffer: pdf.build(), rows };
}
