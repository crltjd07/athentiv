import { all, one, run } from "@/server/db";
import { err, ok, readJson, route } from "@/server/http";
import { requireAuth, type Auth } from "@/server/auth";
import { isPremium, requireStandOwner } from "@/server/access";
import { audioSchema } from "@/shared/schemas";
import { SOUNDS } from "@/shared/catalog";

async function load(auth: Auth) {
  await run("INSERT OR IGNORE INTO study_audio_preferences (user_id, updated_at) VALUES (?, ?)", auth.user.id, Date.now());
  const p = (await one<{ sound_key: string; volume: number }>("SELECT sound_key, volume FROM study_audio_preferences WHERE user_id = ?", auth.user.id))!;
  const premium = await isPremium(auth.user.id);
  const allowed = SOUNDS.find((s) => s.key === p.sound_key)?.tier === "free" || premium;
  const playlists = (await all<{ id: number; spotify_type: string; spotify_id: string; label: string }>(
    "SELECT id, spotify_type, spotify_id, label FROM spotify_playlists WHERE user_id = ? ORDER BY created_at", auth.user.id,
  )).map((p) => ({
    id: p.id,
    type: p.spotify_type,
    label: p.label,
    url: `https://open.spotify.com/${p.spotify_type}/${p.spotify_id}`,
    embedUrl: `https://open.spotify.com/embed/${p.spotify_type}/${p.spotify_id}?utm_source=generator&theme=0`,
  }));
  return { soundKey: allowed ? p.sound_key : "rain", volume: p.volume, playlists };
}

export const GET = route(async () => {
  const auth = await requireAuth();
  requireStandOwner(auth);
  return ok(await load(auth));
});

export const PATCH = route(async (req) => {
  const auth = await requireAuth();
  requireStandOwner(auth);
  const input = await readJson(req, audioSchema);
  if (input.soundKey && SOUNDS.find((s) => s.key === input.soundKey)?.tier === "premium" && !(await isPremium(auth.user.id))) {
    throw err.forbidden("PREMIUM_REQUIRED", "That sound is part of Premium.", { feature: "All ambient sounds" });
  }
  const cur = await load(auth);
  await run(
    "UPDATE study_audio_preferences SET sound_key = ?, volume = ?, updated_at = ? WHERE user_id = ?",
    input.soundKey ?? cur.soundKey, input.volume ?? cur.volume, Date.now(), auth.user.id,
  );
  return ok(await load(auth));
});
