import { ok, route } from "@/server/http";
import { activeSessionsFor, requireAuth } from "@/server/auth";

export const GET = route(async () => {
  const auth = await requireAuth();
  return ok({
    oneDeviceRule: auth.user.account_type === "stand_owner",
    sessions: activeSessionsFor(auth.user.id).map((s) => ({
      id: s.id,
      label: s.label,
      createdAt: s.created_at,
      lastSeenAt: s.last_seen_at,
      current: s.id === auth.session.id,
    })),
  });
});
