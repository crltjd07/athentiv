import { z } from "zod";
import { run } from "@/server/db";
import { ApiError, ok, rateLimit, readJson, route } from "@/server/http";
import { recoveryCode, verifyPassword } from "@/server/crypto";
import { requireAuth } from "@/server/auth";
import { hashRecoveryCode } from "@/server/users";

/** Generates a new recovery code (the old one stops working). Requires the current password. */
export const POST = route(async (req) => {
  const auth = await requireAuth();
  rateLimit(`rc:${auth.user.id}`, 5, 60 * 60_000);
  const { password } = await readJson(req, z.object({ password: z.string().min(1).max(128) }));
  if (!(await verifyPassword(password, auth.user.password_hash))) {
    throw new ApiError(400, "WRONG_PASSWORD", "Incorrect password.", { fields: { password: "Incorrect password." } });
  }
  const code = recoveryCode();
  await run("UPDATE users SET recovery_code_hash = ?, updated_at = ? WHERE id = ?", hashRecoveryCode(code), Date.now(), auth.user.id);
  return ok({ recoveryCode: code });
});
