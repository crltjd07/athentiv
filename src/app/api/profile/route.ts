import { run, tx } from "@/server/db";
import { err, ok, readJson, route } from "@/server/http";
import { requireAuth } from "@/server/auth";
import { premiumOf } from "@/server/access";
import { mePayload, profileOf } from "@/server/users";
import { rebuildRollups } from "@/server/activity";
import { profileSchema } from "@/shared/schemas";
import { avatarOf } from "@/shared/catalog";
import { isValidTimeZone } from "@/shared/day";

export const PATCH = route(async (req) => {
  const auth = await requireAuth();
  const input = await readJson(req, profileSchema);
  const current = profileOf(auth.user.id);

  if (input.avatarKey && input.avatarKey !== current.avatar_key && avatarOf(input.avatarKey).tier === "premium" && !premiumOf(auth.user.id).active) {
    throw err.forbidden("PREMIUM_REQUIRED", "That avatar is part of Premium.", { feature: "Premium avatars" });
  }
  if (input.timezone !== undefined && !isValidTimeZone(input.timezone)) throw err.badRequest("Unknown time zone.");

  const blank = (v: string | null | undefined) => (v === undefined ? undefined : v ? v : null);
  const next = {
    display_name: input.displayName ?? current.display_name,
    avatar_key: input.avatarKey ?? current.avatar_key,
    school: blank(input.school) === undefined ? current.school : blank(input.school),
    course: blank(input.course) === undefined ? current.course : blank(input.course),
    year_level: blank(input.yearLevel) === undefined ? current.year_level : blank(input.yearLevel),
    daily_goal_minutes: input.dailyGoalMinutes ?? current.daily_goal_minutes,
    timezone: input.timezone ?? current.timezone,
    onboarded_at: input.onboarded ? current.onboarded_at ?? Date.now() : current.onboarded_at,
  };
  tx(() => {
    run(
      `UPDATE user_profiles SET display_name = ?, avatar_key = ?, school = ?, course = ?, year_level = ?, daily_goal_minutes = ?,
              timezone = ?, onboarded_at = ?, updated_at = ? WHERE user_id = ?`,
      next.display_name, next.avatar_key, next.school ?? null, next.course ?? null, next.year_level ?? null,
      next.daily_goal_minutes, next.timezone, next.onboarded_at, Date.now(), auth.user.id,
    );
    if (next.timezone !== current.timezone) rebuildRollups(auth.user.id, next.timezone);
  });
  return ok(mePayload({ ...auth, tz: next.timezone }));
});
