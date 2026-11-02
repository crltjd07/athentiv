import { z } from "zod";
import { run } from "@/server/db";
import { ok, readJson, route } from "@/server/http";
import { requireAuth } from "@/server/auth";
import { requireStandOwner } from "@/server/access";

export const POST = route(async (req) => {
  const auth = await requireAuth();
  requireStandOwner(auth);
  const { verificationId } = await readJson(req, z.object({ verificationId: z.number().int().positive().nullable().optional() }));
  if (verificationId) {
    run(
      "UPDATE nfc_verifications SET checkin_status = 'skipped' WHERE id = ? AND user_id = ? AND checkin_status = 'pending'",
      verificationId, auth.user.id,
    );
  }
  return ok({ ok: true });
});
