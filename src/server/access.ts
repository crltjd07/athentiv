// Every Premium / stand-owner / NFC decision is made here, on the server.
import { all, one } from "./db";
import { err } from "./http";
import type { Auth, SessionRow } from "./auth";
import { LIMITS, TIME } from "@/shared/limits";

export type PremiumState = {
  active: boolean;
  until: number | null;
  source: "trial" | "purchase" | "admin" | null;
  daysLeft: number;
  lastEndedAt: number | null;
};

export function premiumOf(userId: number, now = Date.now()): PremiumState {
  const rows = all<{ source: PremiumState["source"]; starts_at: number; ends_at: number }>(
    "SELECT source, starts_at, ends_at FROM user_subscriptions WHERE user_id = ? AND ends_at > ? ORDER BY starts_at",
    userId, now,
  );
  const current = rows.find((r) => r.starts_at <= now);
  if (!current) {
    const last = one<{ ends_at: number }>(
      "SELECT MAX(ends_at) AS ends_at FROM user_subscriptions WHERE user_id = ? AND ends_at <= ?",
      userId, now,
    );
    return { active: false, until: null, source: null, daysLeft: 0, lastEndedAt: last?.ends_at ?? null };
  }
  // Periods are stacked end to end; follow the chain to the final expiry.
  let until = current.ends_at;
  for (const r of rows) if (r.starts_at <= until && r.ends_at > until) until = r.ends_at;
  return { active: true, until, source: current.source, daysLeft: Math.ceil((until - now) / TIME.DAY), lastEndedAt: null };
}

/** The moment a newly bought / granted period should start: now, or the end of the current chain. */
export function nextPeriodStart(userId: number, now = Date.now()): number {
  const p = premiumOf(userId, now);
  return p.active && p.until ? p.until : now;
}

export function nfcOf(session: SessionRow, now = Date.now()) {
  const verified = !!session.nfc_verified_until && session.nfc_verified_until > now;
  return {
    verified,
    verifiedAt: verified ? session.nfc_verified_at : null,
    until: verified ? session.nfc_verified_until : null,
    standId: verified ? session.nfc_stand_id : null,
  };
}

export function accessFor(auth: Auth) {
  const premium = premiumOf(auth.user.id, auth.now);
  const standOwner = auth.user.account_type === "stand_owner";
  const nfc = standOwner ? nfcOf(auth.session, auth.now) : { verified: false, verifiedAt: null, until: null, standId: null };
  const isPremium = premium.active;
  return {
    standOwner,
    premium,
    isPremium,
    nfc,
    features: {
      // Stand-only features: never unlocked by Premium alone.
      checkin: standOwner,
      pomodoro: standOwner,
      stand: standOwner,
      moodHistory: standOwner && isPremium,
      // Premium features available to every account type.
      premiumAvatars: isPremium,
      unlimitedTasks: isPremium,
      advancedTaskFilters: isPremium,
      pomodoroCustom: standOwner && isPremium,
      advancedSummary: isPremium,
      exports: isPremium,
      allSounds: standOwner && isPremium,
      breakExtend: standOwner && isPremium,
    },
    limits: {
      maxOpenTasks: isPremium ? null : LIMITS.freeOpenTasks,
      dailyFocusSessions: isPremium ? null : LIMITS.freeDailyFocusSessions,
      historySessions: isPremium ? LIMITS.premiumHistorySessions : LIMITS.freeHistorySessions,
    },
  };
}
export type Access = ReturnType<typeof accessFor>;

export function requireStandOwner(auth: Auth) {
  if (auth.user.account_type !== "stand_owner") {
    throw err.forbidden(
      "STAND_OWNER_ONLY",
      "This feature is available only to ATHENTIV FocusDock stand owners. Premium does not unlock it.",
    );
  }
}

export function requireNfc(auth: Auth) {
  requireStandOwner(auth);
  if (!nfcOf(auth.session, auth.now).verified) {
    throw err.forbidden("NFC_REQUIRED", "Tap your phone on your FocusDock stand to verify this session first.");
  }
}

export function requirePremium(auth: Auth, feature: string) {
  if (!premiumOf(auth.user.id, auth.now).active) {
    throw err.forbidden("PREMIUM_REQUIRED", `${feature} is a Premium feature.`, { feature });
  }
}
