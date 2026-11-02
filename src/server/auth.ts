import { cookies } from "next/headers";
import type { NextRequest } from "next/server";
import { all, one, run, tx } from "./db";
import { randomToken, sha256 } from "./crypto";
import { err } from "./http";
import { TIMING } from "@/shared/limits";
import { isValidTimeZone } from "@/shared/day";

export const SESSION_COOKIE = "fd_session";
export const DEVICE_COOKIE = "fd_device";

export type UserRow = {
  id: number;
  username: string;
  password_hash: string;
  account_type: "stand_owner" | "standard";
  recovery_code_hash: string | null;
  must_change_password: number;
  trial_granted_at: number | null;
  created_at: number;
  updated_at: number;
};

export type SessionRow = {
  id: number;
  user_id: number;
  device_id: number;
  token_hash: string;
  created_at: number;
  last_seen_at: number;
  expires_at: number;
  revoked_at: number | null;
  revoked_reason: string | null;
  nfc_stand_id: number | null;
  nfc_verified_at: number | null;
  nfc_verified_until: number | null;
};

export type Auth = { user: UserRow; session: SessionRow; tz: string; now: number };

function isHttps(req: NextRequest): boolean {
  if (process.env.COOKIE_SECURE === "true") return true;
  if (process.env.COOKIE_SECURE === "false") return false;
  return (req.headers.get("x-forwarded-proto") ?? req.nextUrl.protocol.replace(":", "")) === "https";
}

function cookieOpts(req: NextRequest, maxAgeSec: number) {
  return { httpOnly: true, sameSite: "lax" as const, secure: isHttps(req), path: "/", maxAge: maxAgeSec };
}

/** Resolves the current session from the cookie. Returns a reason when there is none. */
async function resolve(): Promise<{ auth: Auth } | { reason: "none" | "replaced" | "expired" }> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return { reason: "none" };
  const now = Date.now();
  const session = await one<SessionRow>("SELECT * FROM auth_sessions WHERE token_hash = ?", sha256(token));
  if (!session) return { reason: "expired" };
  if (session.revoked_at) return { reason: session.revoked_reason === "replaced" ? "replaced" : "expired" };
  if (session.expires_at <= now || session.last_seen_at + TIMING.sessionIdleMs <= now) {
    await run("UPDATE auth_sessions SET revoked_at = ?, revoked_reason = 'expired' WHERE id = ?", now, session.id);
    return { reason: "expired" };
  }
  const user = await one<UserRow>("SELECT * FROM users WHERE id = ?", session.user_id);
  if (!user) return { reason: "expired" };
  if (now - session.last_seen_at > 60_000) {
    await run("UPDATE auth_sessions SET last_seen_at = ? WHERE id = ?", now, session.id);
    await run("UPDATE devices SET last_seen_at = ? WHERE id = ?", now, session.device_id);
    session.last_seen_at = now;
  }
  const tz = (await one<{ timezone: string }>("SELECT timezone FROM user_profiles WHERE user_id = ?", user.id))?.timezone;
  return { auth: { user, session, tz: tz && isValidTimeZone(tz) ? tz : "Asia/Manila", now } };
}

export async function getAuth(): Promise<Auth | null> {
  const r = await resolve();
  return "auth" in r ? r.auth : null;
}

export async function requireAuth(): Promise<Auth> {
  const r = await resolve();
  if ("auth" in r) return r.auth;
  if (r.reason === "replaced")
    throw err.unauthenticated("SESSION_REPLACED", "You signed in on another device, so this session was ended.");
  if (r.reason === "expired") throw err.unauthenticated("SESSION_EXPIRED", "Your session has expired. Please sign in again.");
  throw err.unauthenticated();
}

function deviceLabel(ua: string): string {
  const os = /iPhone/.test(ua) ? "iPhone" : /Android/.test(ua) ? "Android" : /iPad/.test(ua) ? "iPad" : "Unknown device";
  const browser = /CriOS|Chrome/.test(ua) && !/Edg/.test(ua)
    ? "Chrome"
    : /FxiOS|Firefox/.test(ua)
      ? "Firefox"
      : /Edg/.test(ua)
        ? "Edge"
        : /SamsungBrowser/.test(ua)
          ? "Samsung Internet"
          : /Safari/.test(ua)
            ? "Safari"
            : "Browser";
  return `${os} · ${browser}`;
}

/**
 * Starts a new session for `user` on the requesting device.
 * Stand-owner accounts are limited to one active device: every other session is revoked,
 * and the other device is told it was replaced on its next request.
 */
export async function startSession(req: NextRequest, user: UserRow): Promise<SessionRow> {
  const store = await cookies();
  let deviceKey = store.get(DEVICE_COOKIE)?.value;
  if (!deviceKey || deviceKey.length < 20 || deviceKey.length > 100) deviceKey = randomToken(24);
  store.set(DEVICE_COOKIE, deviceKey, cookieOpts(req, 60 * 60 * 24 * 730));

  const now = Date.now();
  const token = randomToken(32);
  const label = deviceLabel(req.headers.get("user-agent") ?? "");
  const keyHash = sha256(deviceKey);

  const session = await tx(async () => {
    let device = await one<{ id: number }>("SELECT id FROM devices WHERE user_id = ? AND device_key_hash = ?", user.id, keyHash);
    if (!device) {
      const r = await run(
        "INSERT INTO devices (user_id, device_key_hash, label, first_seen_at, last_seen_at) VALUES (?, ?, ?, ?, ?)",
        user.id, keyHash, label, now, now,
      );
      device = { id: r.id };
    } else {
      await run("UPDATE devices SET label = ?, last_seen_at = ? WHERE id = ?", label, now, device.id);
    }

    if (user.account_type === "stand_owner") {
      await run(
        `UPDATE auth_sessions
            SET revoked_at = ?, revoked_reason = CASE WHEN device_id = ? THEN 'logout' ELSE 'replaced' END
          WHERE user_id = ? AND revoked_at IS NULL`,
        now, device.id, user.id,
      );
    }

    const { id } = await run(
      `INSERT INTO auth_sessions (user_id, device_id, token_hash, created_at, last_seen_at, expires_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      user.id, device.id, sha256(token), now, now, now + TIMING.sessionMaxMs,
    );
    return (await one<SessionRow>("SELECT * FROM auth_sessions WHERE id = ?", id))!;
  });

  store.set(SESSION_COOKIE, token, cookieOpts(req, Math.floor(TIMING.sessionMaxMs / 1000)));
  return session;
}

export async function endSession(sessionId: number | null) {
  if (sessionId) await run("UPDATE auth_sessions SET revoked_at = ?, revoked_reason = 'logout' WHERE id = ? AND revoked_at IS NULL", Date.now(), sessionId);
  (await cookies()).delete(SESSION_COOKIE);
}

/** Revokes every session of the user except `keepSessionId`. */
export async function revokeOtherSessions(userId: number, keepSessionId: number | null, reason: "password_changed" | "password_reset") {
  await run(
    "UPDATE auth_sessions SET revoked_at = ?, revoked_reason = ? WHERE user_id = ? AND revoked_at IS NULL AND id != ?",
    Date.now(), reason, userId, keepSessionId ?? -1,
  );
}

export function activeSessionsFor(userId: number) {
  return all<{ id: number; created_at: number; last_seen_at: number; label: string }>(
    `SELECT s.id, s.created_at, s.last_seen_at, d.label
       FROM auth_sessions s JOIN devices d ON d.id = s.device_id
      WHERE s.user_id = ? AND s.revoked_at IS NULL AND s.expires_at > ?
      ORDER BY s.last_seen_at DESC`,
    userId, Date.now(),
  );
}

// ---------------------------------------------------------------------------
// Login throttling (persistent, per username) — complements the in-memory IP limiter.
// ---------------------------------------------------------------------------

export async function assertNotLockedOut(username: string) {
  const since = Date.now() - TIMING.loginLockoutMs;
  const rows = await all<{ success: number; created_at: number }>(
    "SELECT success, created_at FROM login_attempts WHERE username = ? AND created_at > ? ORDER BY created_at DESC LIMIT 20",
    username, since,
  );
  let failures = 0;
  for (const r of rows) {
    if (r.success) break;
    failures++;
  }
  if (failures >= TIMING.loginMaxFailures) {
    const retry = Math.ceil((rows[TIMING.loginMaxFailures - 1].created_at + TIMING.loginLockoutMs - Date.now()) / 1000);
    throw err.tooMany(`Too many failed attempts. Try again in ${Math.max(1, Math.ceil(retry / 60))} minute(s).`, retry);
  }
}

export async function recordLoginAttempt(username: string, ip: string, success: boolean) {
  await run("INSERT INTO login_attempts (username, ip, success, created_at) VALUES (?, ?, ?, ?)", username, ip, success, Date.now());
}
