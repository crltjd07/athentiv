import { ok, route } from "@/server/http";
import { requireAuth } from "@/server/auth";
import { dashboard } from "@/server/stats";
import { settle } from "@/server/pomodoro";

export const GET = route(async () => {
  const auth = await requireAuth();
  // Settle any timer that finished while the app was closed so today's numbers are current.
  const live = auth.user.account_type === "stand_owner" ? await settle(auth) : null;
  return ok({ ...(await dashboard(auth)), liveSession: live ? { id: live.id, kind: live.kind, status: live.status } : null });
});
