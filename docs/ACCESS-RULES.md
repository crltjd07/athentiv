# Access rules, account types & assumptions

All checks below are enforced in `src/server/access.ts` and the route handlers. The UI only mirrors them.

## Account types

| | Stand owner | Non-stand (standard) user |
|---|---|---|
| How the account is created | Premade with the stand (`pnpm stand:create` / `db:seed`). Temporary password must be changed on first sign-in | Self-registration in the app |
| Sign-in | Username + password, **or** tap the stand (tag URL → landing page → password, then verified in one step) | Username + password |
| Devices | **One active device.** A new sign-in revokes other sessions; the old phone sees "Signed in on another device" | Multiple devices allowed |
| Check-in, Pomodoro, Stand page | Yes. Check-in and starting a Pomodoro also need an **NFC-verified session** | **Never**, even with Premium (`403 STAND_OWNER_ONLY`) |
| 30-day Premium trial | Granted automatically on the **first successful NFC verification**, once per account | Not available |

## Baseline rules preserved from the brief

- Premade stand-owner accounts and free registration for non-stand users
- NFC authentication for stand owners alongside manual username/password sign-in
- One active device per stand-owner account
- 30-day Premium on first NFC tap, never repeated. Guarded twice: the `users.trial_granted_at` flag **and** a partial unique index `uq_subs_one_trial` on `user_subscriptions`
- Session expiry and heartbeat
- NFC verification required for Check-in and Pomodoro
- Check-in, Pomodoro and Stand are stand-owner-only, and non-stand users can't reach them even with Premium
- Pomodoro: 15-minute maximum pause, after which the session is cancelled automatically

## ⚠ Assumptions (the referenced spec document was not supplied)

The brief refers to *"FocusDock — Stand Owner vs Non-Stand User Plans and Features"*, which wasn't available during the build. The rules above come from the brief itself. These specific values were **chosen by us** and live in one place, `src/shared/limits.ts` (`TIMING`), so they're easy to align with the original document:

| Setting | Value | Notes |
|---|---|---|
| Heartbeat interval | 60 s | Sent while the app is visible |
| Auth session idle timeout | 14 days | No requests at all |
| Auth session absolute lifetime | 60 days | |
| NFC grace window | 30 min | NFC verification lapses if no heartbeat arrives (app closed / phone away) |
| NFC hard cap | 12 h | A fresh tap renews it |
| Login lockout | 5 failures / 15 min per username | Plus an IP limiter |
| Simultaneous login behaviour | **Newest sign-in wins** | We chose takeover over blocking, so a lost or broken phone can't lock the owner out |
| Running timer when NFC lapses | Keeps running | NFC is checked when a session **starts**, not continuously, because phones sleep and stop heartbeats |
| Viewing Stand page / history without NFC | Allowed (owner only) | Only *actions* (check-in, start focus) require NFC |
| What counts toward "4 sessions per day" | Every focus session **started** today that wasn't cancelled | Cancelled sessions record no focus time, so they can't be used to game the limit |

## NFC design

- Each tag stores `APP_URL/nfc/{STAND_CODE}#k={SECRET}`. Both iPhone and Android open it natively; no app install is needed.
- The secret is in the URL **fragment**, so browsers don't send it in requests, and it doesn't appear in server logs or `Referer` headers. The landing page posts it once to `/api/nfc/verify`, then erases it from browser history.
- Only `sha256(secret)` is stored. Comparison is constant-time. `pnpm stand:rotate` invalidates a leaked tag.
- Every tap (valid, invalid, wrong owner, signed out) is logged in `nfc_verifications`.
- **Limitation:** a static NDEF tag can be copied. See RECOMMENDATIONS (NTAG 424 DNA "SUN" dynamic tags).

## Feature matrix

| Feature | Freemium | Premium | Stand-only? |
|---|---|---|---|
| Avatars | Fox, Owl, Panda, Cat | + Robot, Rocket, Frog, Star | |
| Open tasks | 3 at a time (server-enforced; completing or deleting frees a slot; re-opening counts) | Unlimited | |
| Task filters & sort | Status, type, search; sort by due date / created | + subject, effort; sort by effort / subject | |
| Summary | Current week, basic overview, insights | + month, custom range, previous-period comparison, subject & type breakdowns | |
| Exports (CSV / PDF / JSON) | — | ✓ with date range | |
| Pomodoro presets | 25/5 | + 50/10, custom (focus 1–180, break 1–60) | ✓ |
| Focus sessions / day | 4 | Unlimited | ✓ |
| Pomodoro history | Last 5, no stats | Last 20 + statistics | ✓ |
| Break extension (+5 min, ×2) | — | ✓ | ✓ |
| Task focus history | Total minutes only | Per-session list | ✓ |
| Ambient sounds | Rain, brown, white | All 8 | ✓ |
| Mood check-in | ✓ | ✓ | ✓ |
| Mood history, calendar, trends, comparison | — | ✓ | ✓ |

**On expiry:** access is recomputed on every request from `user_subscriptions`, so restrictions apply immediately and no cron job is needed. All data is kept. Users can still view, edit, complete and delete tasks, but can't go above 3 open tasks.
