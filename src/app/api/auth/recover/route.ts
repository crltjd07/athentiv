import { one, run, tx } from "@/server/db";
import { ApiError, clientIp, ok, rateLimit, readJson, route } from "@/server/http";
import { hashPassword, recoveryCode, safeEqualHex } from "@/server/crypto";
import { assertNotLockedOut, recordLoginAttempt, revokeOtherSessions, type UserRow } from "@/server/auth";
import { hashRecoveryCode } from "@/server/users";
import { recoverSchema } from "@/shared/schemas";

/** Password reset with the one-time recovery code. Issues a fresh recovery code and signs out everywhere. */
export const POST = route(async (req) => {
  const ip = clientIp(req);
  rateLimit(`recover:${ip}`, 10, 60 * 60_000);
  const input = await readJson(req, recoverSchema);
  assertNotLockedOut(input.username);

  const user = one<UserRow>("SELECT * FROM users WHERE username = ?", input.username);
  const valid = !!user?.recovery_code_hash && safeEqualHex(hashRecoveryCode(input.recoveryCode), user.recovery_code_hash);
  recordLoginAttempt(input.username, ip, valid);
  if (!user || !valid) throw new ApiError(401, "INVALID_RECOVERY", "That username and recovery code don't match.");

  const passwordHash = await hashPassword(input.newPassword);
  const code = recoveryCode();
  tx(() => {
    run(
      "UPDATE users SET password_hash = ?, recovery_code_hash = ?, must_change_password = 0, updated_at = ? WHERE id = ?",
      passwordHash, hashRecoveryCode(code), Date.now(), user.id,
    );
    revokeOtherSessions(user.id, null, "password_reset");
  });
  return ok({ ok: true, recoveryCode: code });
});
