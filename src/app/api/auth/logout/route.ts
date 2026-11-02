import { ok, route } from "@/server/http";
import { endSession, getAuth } from "@/server/auth";

export const POST = route(async () => {
  const auth = await getAuth();
  await endSession(auth?.session.id ?? null);
  return ok({ ok: true });
});
