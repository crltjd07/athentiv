import { z } from "zod";
import { all, one, run, tx } from "@/server/db";
import { ok, readJson, readQuery, route } from "@/server/http";
import { requireAuth } from "@/server/auth";
import { premiumOf, requireNfc, requirePremium, requireStandOwner } from "@/server/access";
import { checkAchievements, recomputeAt } from "@/server/activity";
import { moodInsights } from "@/server/stats";
import { checkinSchema } from "@/shared/schemas";
import { checkinResponse } from "@/shared/motivation";
import { addDays, dayOf } from "@/shared/day";

type Row = { id: number; mood: string; mindset: string; intensity: number | null; note: string | null; created_at: number };
const dto = (r: Row) => ({ id: r.id, mood: r.mood, mindset: r.mindset, intensity: r.intensity, note: r.note, createdAt: r.created_at });

/** Stand owners with a verified NFC session can check in; Freemium accounts don't see past entries. */
export const POST = route(async (req) => {
  const auth = await requireAuth();
  requireNfc(auth);
  const input = await readJson(req, checkinSchema);
  const premium = premiumOf(auth.user.id, auth.now).active;

  const result = tx(() => {
    const previous = one<Row>("SELECT * FROM mood_checkins WHERE user_id = ? ORDER BY created_at DESC LIMIT 1", auth.user.id);
    let verificationId: number | null = null;
    if (input.verificationId) {
      const v = one<{ id: number }>("SELECT id FROM nfc_verifications WHERE id = ? AND user_id = ? AND session_id = ?", input.verificationId, auth.user.id, auth.session.id);
      if (v) {
        verificationId = v.id;
        run("UPDATE nfc_verifications SET checkin_status = 'done' WHERE id = ?", v.id);
      }
    }
    const now = Date.now();
    const id = run(
      "INSERT INTO mood_checkins (user_id, nfc_verification_id, mood, mindset, intensity, note, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
      auth.user.id, verificationId, input.mood, input.mindset, input.intensity ?? null, input.note || null, now,
    ).id;
    recomputeAt(auth.user.id, auth.tz, now);
    checkAchievements(auth.user.id, auth.tz, true);
    return { checkin: one<Row>("SELECT * FROM mood_checkins WHERE id = ?", id)!, previous };
  });

  return ok(
    {
      checkin: dto(result.checkin),
      response: checkinResponse(input.mood, input.mindset),
      // Comparing with earlier check-ins is part of mood history, which is Premium.
      previous: premium && result.previous ? dto(result.previous) : null,
      historyLocked: !premium,
    },
    { status: 201 },
  );
});

export const GET = route(async (req) => {
  const auth = await requireAuth();
  requireStandOwner(auth);
  requirePremium(auth, "Mood history");
  const { days } = readQuery(req, z.object({ days: z.coerce.number().int().min(7).max(120).default(30) }));
  const to = dayOf(auth.tz, auth.now);
  const from = addDays(to, -(days - 1));
  const items = all<Row>(
    "SELECT * FROM mood_checkins WHERE user_id = ? ORDER BY created_at DESC LIMIT 200", auth.user.id,
  ).map(dto);
  const daily = all<{ day: string; focus_minutes: number }>(
    "SELECT day, focus_minutes FROM daily_productivity_summaries WHERE user_id = ? AND day >= ? AND day <= ?", auth.user.id, from, to,
  ).map((d) => ({ day: d.day, focusMinutes: d.focus_minutes }));
  return ok({ from, to, items, insights: moodInsights(auth.user.id, auth.tz, from, to, daily) });
});
