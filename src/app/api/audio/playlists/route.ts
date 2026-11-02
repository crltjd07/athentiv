import { isUniqueViolation, one, run } from "@/server/db";
import { err, ok, readJson, route } from "@/server/http";
import { requireAuth } from "@/server/auth";
import { requireStandOwner } from "@/server/access";
import { spotifyLinkSchema } from "@/shared/schemas";
import { LIMITS } from "@/shared/limits";

/** Accepts open.spotify.com links (incl. intl-xx paths) and spotify: URIs for playlists and albums. */
function parseSpotify(input: string): { type: "playlist" | "album"; id: string } | null {
  const uri = input.match(/^spotify:(playlist|album):([A-Za-z0-9]{10,40})$/);
  if (uri) return { type: uri[1] as "playlist" | "album", id: uri[2] };
  try {
    const u = new URL(input);
    if (u.hostname !== "open.spotify.com") return null;
    const m = u.pathname.match(/^\/(?:intl-[a-z-]+\/)?(?:embed\/)?(playlist|album)\/([A-Za-z0-9]{10,40})\/?$/);
    return m ? { type: m[1] as "playlist" | "album", id: m[2] } : null;
  } catch {
    return null;
  }
}

export const POST = route(async (req) => {
  const auth = await requireAuth();
  requireStandOwner(auth);
  const input = await readJson(req, spotifyLinkSchema);
  const parsed = parseSpotify(input.url);
  if (!parsed) throw err.badRequest("Paste a Spotify playlist or album link, e.g. https://open.spotify.com/playlist/…");
  const count = one<{ n: number }>("SELECT COUNT(*) AS n FROM spotify_playlists WHERE user_id = ?", auth.user.id)!.n;
  if (count >= LIMITS.maxSpotifyLinks) throw err.badRequest(`You can save up to ${LIMITS.maxSpotifyLinks} Spotify links.`);
  try {
    run(
      "INSERT INTO spotify_playlists (user_id, spotify_type, spotify_id, label, created_at) VALUES (?, ?, ?, ?, ?)",
      auth.user.id, parsed.type, parsed.id, input.label || (parsed.type === "album" ? "Study album" : "Study playlist"), Date.now(),
    );
  } catch (e) {
    if (isUniqueViolation(e)) throw err.conflict("DUPLICATE", "You've already saved that link.");
    throw e;
  }
  return ok({ ok: true }, { status: 201 });
});
