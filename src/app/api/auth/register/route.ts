import { clientIp, ok, rateLimit, readJson, route } from "@/server/http";
import { startSession } from "@/server/auth";
import { createAccount } from "@/server/users";
import { registerSchema } from "@/shared/schemas";

/** Self-registration always creates a standard (non-stand) account. Stand-owner accounts are premade. */
export const POST = route(async (req) => {
  rateLimit(`register:${clientIp(req)}`, 5, 60 * 60_000);
  const input = await readJson(req, registerSchema);
  const { user, recoveryCode } = await createAccount({
    username: input.username,
    password: input.password,
    displayName: input.displayName,
    accountType: "standard",
    timezone: input.timezone,
  });
  await startSession(req, user);
  return ok({ ok: true, recoveryCode }, { status: 201 });
});
