import { idParam, ok, readJson, route } from "@/server/http";
import { requireAuth } from "@/server/auth";
import { nfcOf } from "@/server/access";
import { pomodoroState, sessionAction } from "@/server/pomodoro";
import { pomodoroActionSchema } from "@/shared/schemas";

type Ctx = { params: Promise<{ id: string }> };

/** pause | resume | cancel | end_early | skip | extend | sync | start_break */
export const POST = route<Ctx>(async (req, ctx) => {
  const auth = await requireAuth();
  const id = idParam((await ctx.params).id);
  const { action } = await readJson(req, pomodoroActionSchema);
  sessionAction(auth, id, action);
  return ok({ ...pomodoroState(auth), nfc: nfcOf(auth.session, auth.now) });
});
