import { run } from "@/server/db";
import { ok, readJson, route } from "@/server/http";
import { requireAuth } from "@/server/auth";
import { premiumOf, requirePremium, requireStandOwner } from "@/server/access";
import { getConfig, pomodoroState } from "@/server/pomodoro";
import { pomodoroConfigSchema } from "@/shared/schemas";

export const PUT = route(async (req) => {
  const auth = await requireAuth();
  requireStandOwner(auth);
  const input = await readJson(req, pomodoroConfigSchema);
  if ((input.preset && input.preset !== "25/5") || input.customFocusMinutes || input.customBreakMinutes) {
    if (!premiumOf(auth.user.id).active) requirePremium(auth, "Custom Pomodoro settings");
  }
  const c = getConfig(auth.user.id);
  run(
    `UPDATE pomodoro_configurations SET preset = ?, custom_focus_minutes = ?, custom_break_minutes = ?, auto_start_break = ?,
            daily_goal_sessions = ?, updated_at = ? WHERE user_id = ?`,
    input.preset ?? c.preset,
    input.customFocusMinutes ?? c.custom_focus_minutes,
    input.customBreakMinutes ?? c.custom_break_minutes,
    input.autoStartBreak ?? !!c.auto_start_break,
    input.dailyGoalSessions ?? c.daily_goal_sessions,
    Date.now(),
    auth.user.id,
  );
  return ok(pomodoroState(auth));
});
