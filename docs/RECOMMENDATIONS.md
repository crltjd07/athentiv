# Recommendations for ATHENTIV FocusDock

These are **suggestions, not implemented**. They're separate from the delivered build. Complexity: **S** ≈ days, **M** ≈ 1–2 weeks, **L** ≈ a month or more.

## A. Product functionality

**1. Dock-aware focus ("phone stays on the stand")**
- *Description:* Pause or flag a focus session when the phone is lifted, using the device-orientation/motion sensors (the phone sits at a fixed angle on the stand) together with the page-visibility API.
- *Problem:* Today the stand verifies presence once at the start; nothing tells whether the student actually stayed docked.
- *Benefit:* Makes "docked minutes" a meaningful, honest measure, and gives the physical stand a real job during the session.
- *Implementation:* `DeviceOrientationEvent` (iOS needs a permission prompt) → detect tilt changes beyond a threshold → client sends `pause` with reason `lifted`; store `undocked_seconds` per session.
- *Tier:* Freemium (core identity). *Complexity:* M

**2. Class schedule + syllabus import**
- *Description:* Add a weekly timetable, and paste or photograph a syllabus or a group-chat announcement to extract deadlines.
- *Problem:* Deadlines arrive in Messenger groups and LMS posts; typing each one is the main friction.
- *Benefit:* The deadline list fills itself; fewer missed tasks.
- *Implementation:* reuse `src/shared/taskParser.ts` for multi-line paste; an optional server-side LLM extraction endpoint for photos (review-before-save, same as voice).
- *Tier:* Paste = Freemium; photo/AI extraction = Premium. *Complexity:* M

**3. LMS / Google Classroom sync**
- *Description:* Read-only import of assignments from Google Classroom (and Canvas/Moodle where schools allow it).
- *Problem:* Manual re-entry; deadlines change without notice.
- *Benefit:* Always-current tasks.
- *Implementation:* OAuth 2.0 with the Classroom API (`courses.courseWork.list`), a nightly sync job, and an `external_id` column on `tasks` to deduplicate.
- *Tier:* Premium. *Complexity:* L

**4. Real push notifications (PWA)**
- *Description:* Deadline and break-over alerts while the app is closed.
- *Problem:* Reminders currently appear only in the in-app inbox or while the app is open.
- *Benefit:* Reminders that actually reach the student.
- *Implementation:* Service worker + Web Push (VAPID keys in env) + a `push_subscriptions` table + a scheduled sender. iOS supports this only for home-screen installed PWAs (16.4+).
- *Tier:* Freemium (deadlines), Premium (custom schedules). *Complexity:* M

**5. Spotify Web Playback**
- *Description:* Control the student's playlist from the focus screen (play, pause, skip, auto-pause on break).
- *Problem:* The current version embeds Spotify's player and links out, which works but isn't integrated.
- *Implementation:* Spotify OAuth (PKCE) + Web Playback SDK. It requires **Spotify Premium** on the user's side, and the SDK doesn't run in iOS Safari, so keep the embed as the fallback.
- *Tier:* Premium. *Complexity:* M

## B. Premium conversion

**6. Contextual "taste" of Premium**
- *Description:* When a Freemium user hits a limit, offer that one feature free for 24 hours (for example one custom-length session, or one monthly report) instead of only showing an upgrade wall.
- *Problem:* Locks feel punitive; users never experience the value.
- *Implementation:* a `feature_trials(user_id, feature, used_at)` table checked in `accessFor`.
- *Tier:* conversion mechanic. *Complexity:* S

**7. Student verification discount & semester plan**
- *Description:* ₱449 per 5-month semester, plus a discount for a verified school email (`.edu.ph`).
- *Problem:* Students budget per semester; annual feels long, monthly feels recurring.
- *Implementation:* new plan row + email-domain verification code.
- *Tier:* pricing. *Complexity:* S

**8. Group "study rooms" (Premium host, free guests)**
- *Description:* Friends join a shared focus timer and see each other's docked status.
- *Problem:* Studying alone is hard to keep up; peer accountability helps.
- *Benefit:* Viral loop. One Premium host brings in free users.
- *Implementation:* a `rooms` table + server-sent events; reuse the timestamp timer model (shared `started_at`).
- *Tier:* Premium to host. *Complexity:* L

## C. Retention

**9. Weekly reflection ritual**
- *Description:* A Sunday evening card: last week's real stats, the student picks 1–3 priorities for the coming week, and next Sunday compares the two.
- *Problem:* Stats without reflection rarely change habits.
- *Implementation:* a `weekly_goals` table; data already exists in `daily_productivity_summaries`.
- *Tier:* Freemium (basic), Premium (history). *Complexity:* S

**10. Streak protection & milestone rewards**
- *Description:* One "rest day" per week that doesn't break a streak; milestone badges unlock cosmetic avatar accessories.
- *Problem:* A single missed day resets motivation to zero.
- *Implementation:* extend `streakOf()`; accessories as a new avatar layer.
- *Tier:* Freemium (rest day), Premium (accessories). *Complexity:* S

## D. Brand differentiation (the stand)

**11. Tamper-resistant dynamic NFC tags (NTAG 424 DNA "SUN")**
- *Description:* Each tap produces a one-time cryptographic code (AES-CMAC + counter), so copying the URL is useless.
- *Problem:* A static tag URL can be photographed and replayed. That's mitigated today by a password and one-device login, but not prevented.
- *Implementation:* store each stand's AES key server-side (KMS) and verify the CMAC plus a strictly increasing counter in `resolveStand()`. Costs about ₱40 more per tag than an NTAG213.
- *Tier:* platform/security. *Complexity:* M

**12. Stand LED / charging signals**
- *Description:* A future stand revision with a BLE microcontroller (for example an ESP32-C3) that glows blue during focus and green on break, so friends and family know not to interrupt.
- *Benefit:* A physical "do not disturb" signal no app-only competitor can offer.
- *Implementation:* Web Bluetooth (Android Chrome) or a companion app on iOS; the session state already exists.
- *Tier:* hardware. *Complexity:* L

## E. Technical

**13. Postgres + managed hosting**
- *Description:* Port `src/server/db.ts` to Postgres (Neon or Supabase) for horizontal scaling and serverless hosting.
- *Benefit:* Point-in-time backups, multiple instances.
- *Complexity:* M

**14. Redis rate limiting & a job queue**
- *Description:* Move the IP limiter and notification sweeps (currently computed on request) to Redis and a scheduled worker.
- *Complexity:* S–M

**15. Observability & privacy**
- *Description:* Structured logs with request IDs, error monitoring (for example Sentry), account deletion and data-download self-service, and a privacy notice under the Philippine **Data Privacy Act (RA 10173)**. Mood data is sensitive personal information.
- *Complexity:* M

**16. Offline-first task capture**
- *Description:* Cache tasks in IndexedDB and queue changes while offline (service worker background sync).
- *Problem:* Student mobile data is spotty.
- *Complexity:* M

## Weaknesses / open questions in the original specification

1. **Data portability vs. Premium-only exports.** The spec makes all exports Premium. Under RA 10173 users have a right to obtain their personal data. *Suggestion:* keep CSV/PDF reports Premium, but give every user a free raw JSON "Download my data". **Not changed in the build** (exports remain Premium-only, as specified).
2. **Missing referenced document.** The stand-owner specification wasn't supplied; the timing values listed in ACCESS-RULES.md are assumptions and should be confirmed.
3. **Stand owners with an expired trial lose features they've grown used to.** That's intended, but consider giving stand owners a permanently cheaper Premium price, since they've already paid for hardware.
4. **"Four focus sessions per day"** doesn't define whether cancelled or ended-early sessions count. We count all started sessions except cancelled ones, and documented this.
5. **Recovery for premade accounts.** The spec doesn't say how stand owners recover a lost password. We issue a recovery code at first sign-in; ATHENTIV support could also reset an account against proof of stand ownership.
6. **iOS cookie partitioning.** An NFC tap opens Safari; a home-screen-installed PWA on iOS has a separate cookie jar, so the tap may verify a different session. Consider telling iPhone users to use FocusDock in Safari (not installed), or add a short-code hand-off.
