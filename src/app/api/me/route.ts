import { ok, route } from "@/server/http";
import { requireAuth } from "@/server/auth";
import { mePayload } from "@/server/users";
import { sweepNotifications } from "@/server/activity";

export const GET = route(async () => {
  const auth = await requireAuth();
  sweepNotifications(auth);
  return ok(mePayload(auth));
});
