import { one, run } from "@/server/db";
import { ok, readJson, route } from "@/server/http";
import { requireAuth } from "@/server/auth";
import { preferencesSchema } from "@/shared/schemas";

type PrefRow = {
  deadline_reminders: number; reminder_lead_hours: number; overdue_alerts: number; session_sound: number;
  session_vibrate: number; daily_summary: number; subscription_alerts: number; weekly_goal_days: number;
};

const toDto = (p: PrefRow) => ({
  deadlineReminders: !!p.deadline_reminders,
  reminderLeadHours: p.reminder_lead_hours,
  overdueAlerts: !!p.overdue_alerts,
  sessionSound: !!p.session_sound,
  sessionVibrate: !!p.session_vibrate,
  dailySummary: !!p.daily_summary,
  subscriptionAlerts: !!p.subscription_alerts,
  weeklyGoalDays: p.weekly_goal_days,
});

const load = (userId: number) => one<PrefRow>("SELECT * FROM user_preferences WHERE user_id = ?", userId)!;

export const GET = route(async () => {
  const auth = await requireAuth();
  return ok(toDto(load(auth.user.id)));
});

export const PATCH = route(async (req) => {
  const auth = await requireAuth();
  const input = await readJson(req, preferencesSchema);
  const cur = toDto(load(auth.user.id));
  const n = { ...cur, ...input };
  run(
    `UPDATE user_preferences SET deadline_reminders = ?, reminder_lead_hours = ?, overdue_alerts = ?, session_sound = ?,
            session_vibrate = ?, daily_summary = ?, subscription_alerts = ?, weekly_goal_days = ?, updated_at = ? WHERE user_id = ?`,
    n.deadlineReminders, n.reminderLeadHours, n.overdueAlerts, n.sessionSound, n.sessionVibrate, n.dailySummary,
    n.subscriptionAlerts, n.weeklyGoalDays, Date.now(), auth.user.id,
  );
  return ok(toDto(load(auth.user.id)));
});
