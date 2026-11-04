# Going live: Vercel + Turso, from `git push` to signing in on a phone

The app runs on **Vercel** (free Hobby plan) and stores its data in **Turso** (hosted SQLite, free tier). You create stands and owner accounts **from your own PC**; the CLI scripts write straight to the live Turso database.

```
your PC ──git push──▶ GitHub ──auto-deploy──▶ Vercel (app)  ──▶ Turso (database)
your PC ──pnpm stand:create──────────────────────────────────▶ Turso (database)
```

---

## Part 1 — Push the code

In the `athentiv` folder:

```bash
git add -A
git commit -m "ATHENTIV FocusDock: Vercel + Turso"
git push origin main
```

`data/` and `.env.local` are git-ignored, so no database file or secrets are uploaded.

## Part 2 — Create the Turso database

1. Go to **turso.tech** → **Sign up** (GitHub is fine).
2. **Create Database**:
   - Name: `focusdock`
   - Location: **Tokyo** (closest to the Philippines). If it isn't offered, pick the closest one in Asia.
3. Open the database. Copy its **URL**, which looks like `libsql://focusdock-<you>.turso.io`.
4. **Create Token** (sometimes labelled *Generate Token*): read & write, no expiry. Copy it. It's only shown once.

## Part 3 — Connect your PC to the live database

Edit `athentiv/.env.local`:

```
TURSO_DATABASE_URL=libsql://focusdock-<you>.turso.io
TURSO_AUTH_TOKEN=<the token>
APP_URL=https://<your-vercel-address>      ← fill in after Part 4
DEVICE_GATE=on
PAYMENTS_SANDBOX=on
```

Then create the tables:

```bash
pnpm db:migrate
# Database: Turso libsql://focusdock-....turso.io
# Applied: 001_init
```

If you see `Applied: 001_init`, your PC can reach the live database.

> While these lines are in `.env.local`, `pnpm dev` on your PC also uses the **live** data. Put `#` in front of the two `TURSO_` lines whenever you want to develop on the local file instead.

## Part 4 — Deploy on Vercel

1. Go to **vercel.com** → **Sign up** with GitHub.
2. **Add New… → Project** → import **crltjd07/athentiv**.
3. Framework preset: **Next.js** (auto-detected). Leave the build settings as they are.
4. Open **Environment Variables** and add:

   | Name | Value |
   |---|---|
   | `TURSO_DATABASE_URL` | `libsql://focusdock-<you>.turso.io` |
   | `TURSO_AUTH_TOKEN` | the token |
   | `DEVICE_GATE` | `on` |
   | `PAYMENTS_SANDBOX` | `on` |

5. **Deploy**. After about 2 minutes you'll get an address like `https://athentiv.vercel.app` (Vercel adds a suffix if that name is taken). Use the **Production** domain shown on the project page.
6. Check it on your **laptop**: you should see *"ATHENTIV FocusDock is designed exclusively for smartphones"*. That means it's live.
7. Put that address into `APP_URL` in `.env.local` (Part 3).

If the build fails at "Installing dependencies", add the environment variable `ENABLE_EXPERIMENTAL_COREPACK` = `1` and redeploy.

## Part 5 — Create a stand and its owner account

On your PC, in the `athentiv` folder:

```bash
pnpm stand:create FD-2001 juan.delacruz "Juan"
```

```
Database: Turso libsql://focusdock-....turso.io
App URL:  https://athentiv.vercel.app

Created FD-2001 for juan.delacruz
  Temp password: FD-xxxxxxxx
  Recovery code: XXXX-XXXX-XXXX-XXXX
  NFC tag URL:   https://athentiv.vercel.app/nfc/FD-2001#k=...
```

- Check that **both** header lines say Turso and your Vercel address. If they don't, fix `.env.local` first.
- The details are also saved in `data/stand-tags.txt` on your PC. Keep it private.
- Repeat with `FD-2002`, `FD-2003`, … for more stands. `pnpm stand:list` shows them all.

## Part 6 — Program the NFC sticker (optional)

1. Install **NFC Tools** (Android or iPhone) and use an NTAG213/215/216 sticker.
2. Choose **Write → Add a record → URL**, paste the *NFC tag URL*, then **Write** and hold the phone to the sticker.
3. Stick it on the stand.

No sticker? Opening the NFC tag URL in the phone's browser does exactly the same thing.

## Part 7 — Sign in on the phone

1. **Tap the stand** (top of an iPhone / back of an Android) or open the tag URL. FocusDock opens: *"Stand FD-2001 recognised"*.
2. The username is pre-filled. Enter the **temporary password** and tap **Sign in & verify stand**.
3. *"Your 30-day Premium trial has started!"* appears. It only happens once per account.
4. **Onboarding:**
   - set a new password;
   - save the new recovery code;
   - pick an avatar, subjects and a daily goal.
5. Check in (or skip) and you land on **Home**, showing **Docked & verified**.

Later visits: open the address, sign in, and **tap the stand** before starting a focus session.

Non-stand accounts: tap **Create an account** on the live site, then choose a Premium plan (test mode) to start using the app.

## Updating & maintenance

| Task | How |
|---|---|
| Ship code changes | `git push`. Vercel redeploys automatically and the data stays in Turso |
| New stand | `pnpm stand:create …` on your PC |
| Lost or copied sticker | `pnpm stand:rotate FD-2001`, then rewrite the sticker |
| Block a stand | `pnpm stand:disable FD-2001` (`stand:enable` to undo) |
| Address changed | update `APP_URL`, run `stand:rotate` for each stand, rewrite the stickers |
| Back up data | Turso dashboard → database → backups, or `turso db shell focusdock .dump > backup.sql` with the Turso CLI |

## Troubleshooting

- **Every page shows an error after deploying:** the Turso variables are missing or mistyped in Vercel. Fix them, then use **Deployments → ⋯ → Redeploy**.
- **"Incorrect username or password" for a new stand:** the stand was probably created in the local file, not Turso. Check the `Database:` line printed by `stand:create`.
- **The NFC link opens localhost or an old address:** `APP_URL` was wrong when the stand was created. Fix it and run `pnpm stand:rotate FD-2001`.
- **The phone opens the unsupported screen:** use the phone's normal browser, not "Desktop site" mode.
