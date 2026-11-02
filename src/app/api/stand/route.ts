import { ok, route } from "@/server/http";
import { requireAuth } from "@/server/auth";
import { nfcOf, requireStandOwner } from "@/server/access";
import { standInfo } from "@/server/nfc";
import { TIMING } from "@/shared/limits";

export const GET = route(async () => {
  const auth = await requireAuth();
  requireStandOwner(auth);
  return ok({
    ...standInfo(auth),
    nfc: nfcOf(auth.session, auth.now),
    rules: { nfcGraceMs: TIMING.nfcGraceMs, nfcMaxMs: TIMING.nfcMaxMs, heartbeatMs: TIMING.heartbeatMs },
  });
});
