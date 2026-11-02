import { ok, readJson, route } from "@/server/http";
import { requireAuth } from "@/server/auth";
import { nfcOf } from "@/server/access";
import { pomodoroState, startFocus } from "@/server/pomodoro";
import { pomodoroStartSchema } from "@/shared/schemas";

export const POST = route(async (req) => {
  const auth = await requireAuth();
  const input = await readJson(req, pomodoroStartSchema);
  startFocus(auth, input);
  return ok({ ...pomodoroState(auth), nfc: nfcOf(auth.session, auth.now) }, { status: 201 });
});
