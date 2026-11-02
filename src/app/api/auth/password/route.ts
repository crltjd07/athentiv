import { run, tx } from "@/server/db";
import { ApiError, ok, rateLimit, readJson, route } from "@/server/http";
import { hashPassword, verifyPassword } from "@/server/crypto";
import { requireAuth, revokeOtherSessions } from "@/server/auth";
import { changePasswordSchema } from "@/shared/schemas";

export const POST = route(async (req) => {
  const auth = await requireAuth();
  rateLimit(`pw:${auth.user.id}`, 10, 60 * 60_000);
  const input = await readJson(req, changePasswordSchema);
  if (!(await verifyPassword(input.currentPassword, auth.user.password_hash))) {
    throw new ApiError(400, "WRONG_PASSWORD", "Your current password is incorrect.", { fields: { currentPassword: "Incorrect password." } });
  }
  if (input.currentPassword === input.newPassword) {
    throw new ApiError(400, "SAME_PASSWORD", "Choose a password different from your current one.");
  }
  const hash = await hashPassword(input.newPassword);
  tx(() => {
    run("UPDATE users SET password_hash = ?, must_change_password = 0, updated_at = ? WHERE id = ?", hash, Date.now(), auth.user.id);
    revokeOtherSessions(auth.user.id, auth.session.id, "password_changed");
  });
  return ok({ ok: true });
});
