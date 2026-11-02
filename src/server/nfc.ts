// NFC stand verification.
//
// Each stand's NFC tag holds an NDEF URL record:  {APP_URL}/nfc/{STAND_CODE}#k={TAG_SECRET}
// Tapping it opens the landing page natively on Android and iPhone (no app required). The secret
// is in the URL fragment, so it is never sent in plain requests or logged by servers; the landing
// page posts it here, and only its SHA-256 hash is stored.
import { all, one, run, tx } from "./db";
import { err } from "./http";
import { safeEqualHex, sha256 } from "./crypto";
import type { Auth, SessionRow } from "./auth";
import { grantStandTrialOnce } from "./billing";
import { TIMING } from "@/shared/limits";

type StandRow = { id: number; stand_code: string; tag_secret_hash: string; model: string; status: string; created_at: number };

export function normaliseStandCode(code: string) {
  return code.trim().toUpperCase();
}

function logAttempt(fields: { standId?: number | null; userId?: number | null; sessionId?: number | null; result: string; ip: string; trial?: boolean; checkin?: string | null }) {
  return run(
    `INSERT INTO nfc_verifications (stand_id, user_id, session_id, result, trial_granted, checkin_status, ip, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    fields.standId ?? null, fields.userId ?? null, fields.sessionId ?? null, fields.result, !!fields.trial, fields.checkin ?? null, fields.ip, Date.now(),
  ).id;
}

/** Validates the tag proof and returns the stand plus its current owner. */
export function resolveStand(code: string, key: string, ip: string) {
  const stand = one<StandRow>("SELECT * FROM phone_stands WHERE stand_code = ?", normaliseStandCode(code));
  if (!stand || !safeEqualHex(sha256(key), stand.tag_secret_hash)) {
    logAttempt({ standId: stand?.id, result: "invalid_tag", ip });
    throw err.notFound("This NFC tag isn't recognised. Make sure you're tapping an official ATHENTIV FocusDock stand.");
  }
  if (stand.status !== "active") {
    logAttempt({ standId: stand.id, result: "stand_disabled", ip });
    throw err.forbidden("STAND_DISABLED", "This stand has been disabled. Please contact ATHENTIV support.");
  }
  const owner = one<{ id: number; username: string }>(
    `SELECT u.id, u.username FROM stand_assignments a JOIN users u ON u.id = a.user_id
      WHERE a.stand_id = ? AND a.unassigned_at IS NULL`,
    stand.id,
  );
  if (!owner) {
    logAttempt({ standId: stand.id, result: "unassigned", ip });
    throw err.conflict("STAND_UNASSIGNED", "This stand isn't linked to an account yet.");
  }
  return { stand, owner };
}

export function recordLoginRequired(standId: number, ip: string) {
  logAttempt({ standId, result: "login_required", ip });
}

/**
 * Marks the session NFC-verified. A tap on an already-verified session just renews it; a tap that
 * starts a new NFC session prompts a mood check-in. The first-ever verified tap grants the trial.
 */
export function verifySession(auth: Auth, standId: number, ownerId: number, ip: string) {
  if (auth.user.id !== ownerId) {
    logAttempt({ standId, userId: auth.user.id, sessionId: auth.session.id, result: "wrong_owner", ip });
    throw err.forbidden("WRONG_OWNER", "This stand belongs to a different ATHENTIV FocusDock account.");
  }
  return tx(() => {
    const now = Date.now();
    const s = auth.session;
    const alreadyVerified = !!s.nfc_verified_until && s.nfc_verified_until > now && s.nfc_stand_id === standId;
    const until = Math.min(now + TIMING.nfcGraceMs, now + TIMING.nfcMaxMs);
    run(
      "UPDATE auth_sessions SET nfc_stand_id = ?, nfc_verified_at = ?, nfc_verified_until = ? WHERE id = ?",
      standId, alreadyVerified ? s.nfc_verified_at : now, until, s.id,
    );
    const trialGranted = grantStandTrialOnce(auth.user.id);
    const id = logAttempt({
      standId, userId: auth.user.id, sessionId: s.id, result: alreadyVerified ? "refreshed" : "verified", ip,
      trial: trialGranted, checkin: alreadyVerified ? null : "pending",
    });
    return { verificationId: id, newSession: !alreadyVerified, trialGranted };
  });
}

/** Called by the heartbeat: keeps NFC verification alive while the app stays open, up to the hard cap. */
export function extendNfc(session: SessionRow, now = Date.now()) {
  if (!session.nfc_verified_until || session.nfc_verified_until <= now || !session.nfc_verified_at) return;
  const until = Math.min(now + TIMING.nfcGraceMs, session.nfc_verified_at + TIMING.nfcMaxMs);
  if (until > session.nfc_verified_until) {
    run("UPDATE auth_sessions SET nfc_verified_until = ? WHERE id = ?", until, session.id);
    session.nfc_verified_until = until;
  }
}

export function standInfo(auth: Auth) {
  const stand = one<StandRow & { assigned_at: number }>(
    `SELECT s.*, a.assigned_at FROM stand_assignments a JOIN phone_stands s ON s.id = a.stand_id
      WHERE a.user_id = ? AND a.unassigned_at IS NULL`,
    auth.user.id,
  );
  const history = all<{ id: number; result: string; trial_granted: number; created_at: number }>(
    `SELECT id, result, trial_granted, created_at FROM nfc_verifications
      WHERE user_id = ? ORDER BY created_at DESC LIMIT 15`,
    auth.user.id,
  ).map((h) => ({ id: h.id, result: h.result, trialGranted: !!h.trial_granted, at: h.created_at }));
  const device = one<{ label: string; first_seen_at: number; last_seen_at: number }>(
    "SELECT label, first_seen_at, last_seen_at FROM devices WHERE id = ?", auth.session.device_id,
  );
  return {
    stand: stand && { code: stand.stand_code, model: stand.model, status: stand.status, assignedAt: stand.assigned_at },
    device: device && { label: device.label, firstSeenAt: device.first_seen_at, lastSeenAt: device.last_seen_at },
    session: { startedAt: auth.session.created_at, lastSeenAt: auth.session.last_seen_at, expiresAt: auth.session.expires_at },
    trialGrantedAt: auth.user.trial_granted_at,
    history,
  };
}
