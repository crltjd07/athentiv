import { all } from "@/server/db";
import { ok, route } from "@/server/http";
import { requireMember } from "@/server/auth";
import { checkAchievements, streakOf } from "@/server/activity";
import { ACHIEVEMENTS } from "@/shared/achievements";

export const GET = route(async () => {
  const auth = await requireMember();
  const standOwner = auth.user.account_type === "stand_owner";
  await checkAchievements(auth.user.id, auth.tz, standOwner);
  const unlocked = new Map(
    (await all<{ key: string; unlocked_at: number }>("SELECT key, unlocked_at FROM user_achievements WHERE user_id = ?", auth.user.id)).map((r) => [r.key, r.unlocked_at]),
  );
  return ok({
    streak: await streakOf(auth.user.id, auth.tz),
    items: ACHIEVEMENTS.filter((a) => standOwner || !a.standOnly).map((a) => ({ ...a, unlockedAt: unlocked.get(a.key) ?? null })),
  });
});
