import { clientIp, ok, rateLimit, readJson, route } from "@/server/http";
import { getAuth } from "@/server/auth";
import { recordLoginRequired, resolveStand, verifySession } from "@/server/nfc";
import { premiumOf } from "@/server/access";
import { nfcVerifySchema } from "@/shared/schemas";

/**
 * Called by the NFC landing page (/nfc/[code]) and by the in-app Web NFC scanner.
 * - Not signed in → returns `login_required` with the stand owner's username to prefill.
 * - Signed in as the owner → verifies the session (and grants the one-time trial on first tap).
 * - Signed in as someone else → 403 WRONG_OWNER.
 */
export const POST = route(async (req) => {
  const ip = clientIp(req);
  rateLimit(`nfc:${ip}`, 30, 10 * 60_000);
  const input = await readJson(req, nfcVerifySchema);
  const { stand, owner } = await resolveStand(input.code, input.key, ip);
  const auth = await getAuth();
  if (!auth) {
    await recordLoginRequired(stand.id, ip);
    return ok({ status: "login_required", standCode: stand.stand_code, username: owner.username });
  }
  const result = await verifySession(auth, stand.id, owner.id, ip);
  const premium = await premiumOf(auth.user.id);
  return ok({ status: "verified", standCode: stand.stand_code, ...result, premiumUntil: premium.until });
});
