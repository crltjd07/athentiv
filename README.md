# ATHENTIV FocusDock

A mobile-only student productivity web app by **ATHENTIV**. It combines academic task tracking, NFC-verified Pomodoro focus sessions on the FocusDock phone stand, mood check-ins, and productivity summaries, on a Freemium → Premium model.

| Docs | |
|---|---|
| [docs/ACCESS-RULES.md](docs/ACCESS-RULES.md) | Account types, NFC/session rules, feature matrix, **assumptions made** |
| [docs/SUBSCRIPTION.md](docs/SUBSCRIPTION.md) | Proposed PHP pricing, billing architecture, sandbox mode |
| [docs/TESTING.md](docs/TESTING.md) | Automated suite (18 scenarios, 153 checks) + manual phone checklist |
| [docs/RECOMMENDATIONS.md](docs/RECOMMENDATIONS.md) | Post-implementation recommendations and spec gaps |

## Stack

- **Next.js 16** (App Router, route handlers, `proxy.ts`), React 19, TypeScript, Tailwind CSS v4
- **SQLite** through Node's built-in `node:sqlite`: real relational schema, foreign keys, constraints and indexes, with no native modules to compile
- `zod` for validation shared by client and server, and `lucide-react` for icons. Nothing else: password hashing (scrypt), charts, the PDF writer and the ambient-sound engine are all built in.

```
db/migrations/      versioned SQL migrations (applied automatically at startup and by pnpm db:migrate)
scripts/            migrate, seed, stand admin, end-to-end API tests
src/proxy.ts        device gate (server side) + auth redirects
src/server/         all business logic: auth, access control, tasks, pomodoro, billing, stats, exports
src/app/api/        thin route handlers over src/server
src/app/(app)/      authenticated screens (app shell, heartbeat, bottom nav)
src/shared/         catalogues, limits, zod schemas, task-sentence parser (used by client + server)
```

## Requirements

- Node.js **22.13+** (built and tested on Node 24.16) and pnpm
- A phone on the same network as your computer (or a deployed HTTPS URL) to use the app, since desktops are blocked by design

## Setup

```bash
pnpm install
cp .env.example .env.local      # set APP_URL to the address your phone will use
pnpm db:migrate                 # creates data/focusdock.db and applies migrations
pnpm db:seed                    # creates 3 demo stands + premade stand-owner accounts
```

`db:seed` prints each stand's owner login and its **NFC tag URL**, and appends them to `data/stand-tags.txt` (git-ignored, keep private). Demo logins are `owner1`, `owner2` and `owner3` with password `FocusDock2026`; each must change it on first sign-in. Standard (non-stand) accounts are created through the app's **Create account** screen.

### Run

```bash
pnpm dev                        # http://localhost:3000, also on your LAN IP
# or production:
pnpm build && pnpm start
```

Open `http://<your-computer-LAN-IP>:3000` **on your phone**. On a laptop, use Chrome DevTools device emulation (for example iPhone 14) with touch enabled; otherwise you'll see the unsupported-device screen, which is intentional.

### Programming an NFC stand

1. Take the URL for the stand from `data/stand-tags.txt` (format `APP_URL/nfc/FD-1001#k=SECRET`).
2. Write it to an NTAG213/215/216 sticker as a **URL (URI) record**, for example with the free *NFC Tools* app.
3. Tap the phone on the tag. Android and iPhone both open the link natively. Android Chrome users can also use **Scan stand in app** (Web NFC).

Stand administration:

```bash
pnpm stand:create FD-2001 jdelacruz "Juan"   # new stand + premade owner (prints temp password + tag URL)
pnpm stand:list
pnpm stand:rotate FD-2001                    # new tag secret; the old tag stops working
pnpm stand:disable FD-2001 / pnpm stand:enable FD-2001
```

## Tests

```bash
# terminal 1: server on a throwaway database
DATABASE_PATH=data/test.db RATE_LIMITS=off pnpm dev -p 3100
# terminal 2
DATABASE_PATH=data/test.db BASE_URL=http://localhost:3100 pnpm test:api
```

The latest run gave **153 passed, 0 failed**. See [docs/TESTING.md](docs/TESTING.md).

## Deployment

The app is a single Node server with a SQLite file, so it needs **one long-running instance with a persistent disk**:

- **Works as-is:** a VPS, Railway or Render with a persistent volume, Fly.io with a volume, or any Docker host. Point `DATABASE_PATH` at the volume and run `pnpm build && pnpm start` behind HTTPS.
- **Not as-is:** serverless platforms such as Vercel or Netlify Functions, because their file systems are ephemeral and the SQLite data would be lost. To deploy there, port `src/server/db.ts` to Postgres (the SQL is standard apart from `INSERT OR IGNORE`/`ON CONFLICT` syntax and partial indexes, which Postgres also supports).
- HTTPS is required in production for Secure cookies, Web NFC, the Wake Lock API, notifications and the microphone.
- The IP rate limiter is in memory (per instance). For more than one instance, move it to Redis. Per-username login lockout is already stored in the database.
- Back up the database with `sqlite3 focusdock.db ".backup backup.db"` (WAL-safe).

## Status of external integrations

| Integration | Status |
|---|---|
| Database | **Working.** SQLite with migrations, tested |
| NFC | **Working** via tag URL (tested through the API). Web NFC in-app scan written for Android Chrome but **not tested on a physical phone** |
| Payments | **Sandbox only**, clearly labelled. No gateway (for example PayMongo) is connected, and no real money can move |
| Spotify | **Link + official embed player.** No OAuth/Web Playback SDK, because Spotify restricts in-browser playback (see RECOMMENDATIONS) |
| Voice input | Web Speech API (Chrome Android; Safari iOS 14.5+). Typed sentences use the same parser as a fallback |
| Push notifications | **Not implemented.** In-app inbox plus browser notifications while the app is open in the background |
