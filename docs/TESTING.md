# Testing

## Automated end-to-end suite

`scripts/test-api.mjs` runs the brief's 18 scenarios against a real running server and database, using simulated phones that each keep their own cookies. It provisions fresh stands and users on every run, so it can be re-run. To simulate time passing (a timer running out, a pause timeout, a subscription expiring), it shifts stored timestamps directly in the database, which exercises the same timestamp-based logic a real wait would.

```bash
DATABASE_PATH=data/test.db RATE_LIMITS=off pnpm dev -p 3100        # terminal 1
DATABASE_PATH=data/test.db BASE_URL=http://localhost:3100 pnpm test:api   # terminal 2
```

**Latest result: 165 passed, 0 failed** (Node 24.16, Next.js 16.4.3 dev server).

| # | Scenario | What is verified (highlights) |
|---|---|---|
| 1 | Non-stand registration | validation, recovery code, standard account, Freemium, scrypt hash, case-insensitive duplicates |
| 2 | Login | wrong/correct password, logout, lockout after 5 failures, bad recovery code |
| 3 | Stand-owner NFC login | forged key rejected, signed-out tap → login with stand proof, forced password change |
| 4 | First tap → Premium | trial source, ≈30-day expiry |
| 5 | Repeated taps | no second trial (also after re-login); DB unique index blocks a second trial row |
| 6 | Second device | first phone gets `SESSION_REPLACED`; one session remains; standard users unaffected |
| 7 | Manual login without NFC | Pomodoro and Check-in → `NFC_REQUIRED`; Stand page viewable |
| 8 | Freemium task limit | 4th open task refused, complete/delete frees a slot, re-open respects limit, overdue derivation, CSRF, SQL-injection-style search, advanced filters locked |
| 9 | Premium unlimited | sandbox payment, idempotent settle, stacking extension, failed payment, >3 tasks, advanced filters |
| 10 | Pomodoro limits | 50/10 & custom locked, 4 sessions/day then `DAILY_LIMIT`, history limited to 5, Premium sounds locked |
| 11 | Recovery after refresh | remaining time from timestamps, pause excluded, auto-complete + auto-break while closed, extend, 15-min pause timeout, task auto "In progress", task focus minutes |
| 12 | Expiration | immediate Freemium, all tasks kept, limit enforced, edit/complete still allowed, analytics/exports/avatars locked, "Premium ended" notice |
| 13 | Non-stand restrictions | 7 stand endpoints → `STAND_OWNER_ONLY` while Premium; tapping someone else's stand → `WRONG_OWNER` |
| 14 | Mood persistence | stored, history, comparison, distribution; Freemium can check in but not view history |
| 15 | Summary accuracy | focus sessions/minutes equal DB sums; insights quote real numbers; dashboard; achievements |
| 16 | Data export | CSV/PDF, attachment header, JSON removed, own-data only, format validation, Freemium refused, CSV formula injection neutralised, export log |
| 17 | Unsupported devices | Windows, Linux, Chromebook, iPad, Android tablet → unsupported screen; iPhone & Android phone served |
| 18 | Data isolation | 9 cross-user operations → 404, foreign subject rejected, lists only own data, anonymous → 401 |

## Manual checks on a real phone

These depend on hardware or browser APIs that the API suite can't reach:

- [ ] Tap a programmed NFC tag (iPhone and Android) → landing → verified → check-in prompt
- [ ] *Scan stand in app* (Android Chrome, HTTPS only)
- [ ] Focus timer: lock the phone mid-session, unlock → time is correct; screen stays on while docked (Wake Lock)
- [ ] Chime and vibration at the end of focus and break; browser notification when the app is in the background
- [ ] Ambient sounds play and change; volume persists; Spotify embed and "Open" link
- [ ] Voice task: "Programming project due next Friday with large effort" → fields pre-filled, nothing saved until **Save Task**
- [ ] iPad in desktop mode ("Macintosh" UA) → unsupported screen (client capability check)
- [ ] Landscape on a phone → "Please rotate" overlay
- [ ] Airplane mode → offline banner; reconnect → recovers
- [ ] PDF export opens in the phone's viewer

The parser was also checked separately (6 sample sentences, all fields correct). The UI was checked with iPhone-emulated headless Chrome screenshots of Home, Tasks, Add Assignment, Task Details, Focus Session, Summary, Premium, Profile, Check-in, Calendar and the desktop block screen.
