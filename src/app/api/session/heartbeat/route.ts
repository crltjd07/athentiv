import { ok, route } from "@/server/http";
import { requireAuth } from "@/server/auth";
import { extendNfc } from "@/server/nfc";
import { nfcOf, premiumOf } from "@/server/access";
import { sweepNotifications } from "@/server/activity";
import { one, run } from "@/server/db";
import { TIMING } from "@/shared/limits";

/**
 * Sent by the open app every TIMING.heartbeatMs. Keeps the auth session fresh, keeps NFC
 * verification alive while the phone stays docked with the app open, and reports state changes
 * (expired Premium, lapsed NFC, replaced session) so the UI can react immediately.
 */
export const POST = route(async () => {
  const auth = await requireAuth();
  const now = Date.now();
  run("UPDATE auth_sessions SET last_seen_at = ? WHERE id = ?", now, auth.session.id);
  run("UPDATE devices SET last_seen_at = ? WHERE id = ?", now, auth.session.device_id);
  if (auth.user.account_type === "stand_owner") extendNfc(auth.session, now);
  sweepNotifications(auth);
  const unread = one<{ n: number }>("SELECT COUNT(*) AS n FROM user_notifications WHERE user_id = ? AND read_at IS NULL", auth.user.id)!.n;
  const premium = premiumOf(auth.user.id, now);
  return ok({
    serverNow: now,
    nextInMs: TIMING.heartbeatMs,
    nfc: nfcOf(auth.session, now),
    premium: { active: premium.active, until: premium.until },
    unreadNotifications: unread,
  });
});
