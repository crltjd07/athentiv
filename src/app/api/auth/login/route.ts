import { one, run } from "@/server/db";
import { ApiError, clientIp, ok, rateLimit, readJson, route } from "@/server/http";
import { burnPasswordCheck, verifyPassword } from "@/server/crypto";
import { assertNotLockedOut, recordLoginAttempt, startSession, type UserRow } from "@/server/auth";
import { resolveStand, verifySession } from "@/server/nfc";
import { rebuildRollups } from "@/server/activity";
import { loginSchema } from "@/shared/schemas";
import { isValidTimeZone } from "@/shared/day";

export const POST = route(async (req) => {
  const ip = clientIp(req);
  rateLimit(`login:${ip}`, 20, 10 * 60_000);
  const input = await readJson(req, loginSchema);
  assertNotLockedOut(input.username);

  const user = one<UserRow>("SELECT * FROM users WHERE username = ?", input.username);
  const valid = user ? await verifyPassword(input.password, user.password_hash) : (await burnPasswordCheck(input.password), false);
  recordLoginAttempt(input.username, ip, valid);
  if (!user || !valid) throw new ApiError(401, "INVALID_CREDENTIALS", "Incorrect username or password.");

  const session = await startSession(req, user);

  if (input.timezone && isValidTimeZone(input.timezone)) {
    const current = one<{ timezone: string }>("SELECT timezone FROM user_profiles WHERE user_id = ?", user.id)?.timezone;
    if (current !== input.timezone) {
      run("UPDATE user_profiles SET timezone = ?, updated_at = ? WHERE user_id = ?", input.timezone, Date.now(), user.id);
      rebuildRollups(user.id, input.timezone);
    }
  }

  // Logging in from the NFC landing page verifies the stand in the same step.
  let nfc: Record<string, unknown> | null = null;
  if (input.nfc) {
    try {
      const { stand, owner } = resolveStand(input.nfc.code, input.nfc.key, ip);
      const auth = { user, session, tz: "Asia/Manila", now: Date.now() };
      nfc = { ok: true, ...verifySession(auth, stand.id, owner.id, ip) };
    } catch (e) {
      if (!(e instanceof ApiError)) throw e;
      nfc = { ok: false, code: e.code, message: e.message };
    }
  }

  return ok({ ok: true, accountType: user.account_type, mustChangePassword: !!user.must_change_password, nfc });
});
