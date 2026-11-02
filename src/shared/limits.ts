// Plan limits and timing rules. Shared by the server (enforcement) and the client (display only).

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

export const LIMITS = {
  freeOpenTasks: 3,
  freeDailyFocusSessions: 4,
  freeHistorySessions: 5,
  premiumHistorySessions: 20,
  customFocusMinutes: { min: 1, max: 180 },
  customBreakMinutes: { min: 1, max: 60 },
  pauseMaxMs: 15 * MINUTE,
  breakExtendSeconds: 5 * 60,
  maxBreakExtensions: 2,
  trialDays: 30,
  maxChecklistItems: 30,
  maxSubjects: 40,
  maxSpotifyLinks: 5,
} as const;

/**
 * Session and NFC timings.
 *
 * ASSUMPTION: the original "Stand Owner vs Non-Stand User" specification was not supplied with
 * the build brief, so the exact numbers below were chosen by us and are documented in
 * docs/ACCESS-RULES.md. Change them here and every check (server and UI) follows.
 */
export const TIMING = {
  /** Client heartbeat interval while the app is open. */
  heartbeatMs: 60_000,
  /** An auth session ends after this long without any request. */
  sessionIdleMs: 14 * DAY,
  /** An auth session always ends after this long, regardless of activity. */
  sessionMaxMs: 60 * DAY,
  /** NFC verification lapses if no heartbeat arrives within this window (phone left the stand / app closed). */
  nfcGraceMs: 30 * MINUTE,
  /** NFC verification always lapses this long after the tap; tapping again renews it. */
  nfcMaxMs: 12 * HOUR,
  /** Failed logins allowed per username within the lockout window. */
  loginMaxFailures: 5,
  loginLockoutMs: 15 * MINUTE,
} as const;

export const TIME = { MINUTE, HOUR, DAY } as const;
