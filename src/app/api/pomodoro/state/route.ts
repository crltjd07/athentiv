import { ok, route } from "@/server/http";
import { requireAuth } from "@/server/auth";
import { nfcOf, requireStandOwner } from "@/server/access";
import { pomodoroState } from "@/server/pomodoro";

export const GET = route(async () => {
  const auth = await requireAuth();
  requireStandOwner(auth);
  return ok({ ...pomodoroState(auth), nfc: nfcOf(auth.session, auth.now) });
});
