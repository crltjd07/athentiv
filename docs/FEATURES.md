# ATHENTIV FocusDock: App Overview & Features

**Live site:** https://athentiv.vercel.app (opens on smartphones only)
**Company:** ATHENTIV · **Product:** ATHENTIV FocusDock

---

## 1. What is ATHENTIV FocusDock?

ATHENTIV FocusDock is a **mobile-only student productivity web app** that works together with the **FocusDock phone stand**. It helps students:

- keep every assignment, quiz, project and exam in one place instead of scattered across group chats and notes;
- check in on how they feel before studying;
- study in focused Pomodoro sessions while their phone sits on the stand;
- see what they actually accomplished through weekly and monthly summaries.

The phone stand has an **NFC tag**. Tapping the phone on the stand proves the student is "docked" and unlocks the focus features. The app runs on a **Freemium → Premium** subscription model.

### Who it's for
- **Stand owners:** students who own a FocusDock stand. They get every feature, including Focus, Check-in and the Stand page.
- **Non-stand users:** students without a stand. They get task management, the calendar, summaries and Premium upgrades, but not the stand-only features.

---

## 2. Account types

| | Stand owner | Non-stand user |
|---|---|---|
| How the account is made | **Premade** by ATHENTIV with the stand (`pnpm stand:create`) | Self-registration in the app |
| Plan | Freemium, with optional Premium | **Premium plan required**: no free tier, the app opens the Premium page until they subscribe |
| Sign-in | Username + password, or **tap the stand** and enter the password | Username + password |
| Devices | **One active phone at a time.** Signing in elsewhere signs the other phone out | Several devices allowed |
| Focus (Pomodoro), Check-in, Stand page | ✅ (Focus and Check-in need an NFC tap) | ❌ Never, even with Premium |
| 30-day Premium trial | ✅ Automatically on the **first** stand tap, once per account | ❌ |
| First sign-in | Must change the temporary password and save a recovery code | Saves a recovery code at sign-up |

---

## 3. Platform & access rules

### Smartphones only
- Works on **Android phones and iPhones** in their normal mobile browsers.
- **Laptops, desktops, tablets and iPads are blocked.** They see a branded screen: *"ATHENTIV FocusDock is designed exclusively for smartphones. For the best experience, please open this website using your Android or iOS device."*
- The check combines the browser's device identifier (user agent) with touch support and screen size, so a laptop browser can't pass by pretending to be a phone.
- Portrait only: turning a phone sideways shows "Please rotate your phone".
- Respects phone notches and safe areas, and uses large touch-friendly controls.

### NFC stand verification
- Each stand's NFC tag holds a secure link (`/nfc/STAND-CODE#k=secret`). Tapping it opens FocusDock on both iPhone and Android, with **no app install needed**.
- Android Chrome users can also use **Scan stand in app** (Web NFC).
- A tap marks the current session **NFC-verified**, which unlocks Focus and Check-in.
- Verification stays active while the app is open, and ends after **30 minutes** without activity or **12 hours** at most. Tap again to renew.
- The first tap on an account grants the **one-time 30-day Premium trial**. Later taps never grant it again.
- Every tap is logged: verified, renewed, wrong account, invalid tag, or signed out.

### Sessions
- The app checks in with the server every **60 seconds** while open, to keep the session and NFC verification alive.
- Sessions end after **14 days** of no use, or **60 days** at most.
- If a stand owner signs in on another phone, the first phone shows *"Signed in on another device"*.

---

## 4. Features

### Feature 1: Profile creation & selection
- Account registration (non-stand users), username + password sign-in, and sign-out
- **Non-stand sign-up flow:** create account → save the recovery code (*"Account created"*) → choose a plan on the Premium page → checkout (plan, amount and reference, with **Confirm payment** or **Cancel**) → onboarding. No test-mode notices or simulation buttons are shown along the way. Stand owners keep their own flow: premade account, temporary-password change and recovery code in onboarding
- **Onboarding wizard:** choose an avatar, pick subjects, and set a daily study goal (stand owners also change their temporary password)
- **Avatars**
  - Freemium: 🦊 Fox · 🦉 Owl · 🐼 Panda · 🐱 Cat
  - Premium: 🤖 Robot · 🚀 Rocket · 🐸 Frog · ⭐ Star (crown badge; locked with a preview and an upgrade prompt)
- Edit profile: display name, school, course/strand, year level, daily study goal
- **Profile completion indicator** showing what's still missing
- Account info: username, account type, member-since date, plan and expiry, stand code
- Personalised greeting ("Good morning, Alex 🎓")
- **Security:** change password, generate a new recovery code, see signed-in devices
- **Password recovery** with a one-time recovery code (no email needed)
- **Copying the recovery code:** the **Copy code** button on the recovery-code card (shown after creating an account without a stand, during stand-owner onboarding, and when generating a new code in Settings) copies the full code and confirms with *Copied* and a *Recovery code copied* message.
  - It first uses the browser's Clipboard API. That API exists only on secure pages (HTTPS or `localhost`), so it was missing when a phone opened the app over plain `http://` on the local network, and copying always failed. In that case the button now falls back to the older copy command on a hidden, selected text field.
  - If the browser blocks copying entirely, the code is selected on screen so the phone's own **Copy** option can be used. A **Save as file** button also appears and downloads `focusdock-recovery-code.txt`, with a message explaining both options.

### Feature 2: Mood tracker / Check-in *(stand owners only)*
- Prompted after each **new NFC session**, and can be skipped
- **Moods:** Great 😄 · Good 🙂 · Okay 😐 · Tired 😴 · Stressed 😣 · Unmotivated 😶
- **Mindsets:** Ready to study · Need to focus · Feeling distracted · Feeling pressured · Just getting started
- Optional **intensity** (5 levels: A little · Somewhat · Moderately · Quite · Very) and an optional private **note**
  - The intensity buttons size themselves from their labels and then share the remaining width, so every button has the same side padding. Longer labels such as *Somewhat* and *Moderately* are no longer squeezed against their edges.
  - All five stay on one row from 340 px wide upwards (checked at 360, 390 and 430 px), and they wrap only on narrower screens.
  - A selected button keeps the same size as the others.
- Supportive **motivational message**, a study tip, and a **study-readiness** suggestion with a recommended task size
- **Premium:** comparison with the previous check-in, a 5-week **mood calendar**, mood distribution, average focus minutes per mood, and a list of recent check-ins
- **Freemium:** can check in, but not see history
- Clearly worded as personal reflection, not a medical or psychological assessment

### Feature 3: Pomodoro with task selection *(stand owners only, NFC required)*
**Timer**
| | Freemium | Premium |
|---|---|---|
| Presets | 25/5 | 25/5 · 50/10 · **Custom** (focus 1–180 min, break 1–60 min) |
| Sessions per day | 4 | Unlimited |
| History | Last 5 | Last 20 + statistics |

**Task selection:** link a session to a task (title, subject, deadline, effort shown) or choose **General study**. Linking moves the task to *In progress* automatically, and the focus minutes add up per task.

**Focus screen** (distraction-free, deep blue): animated circular countdown, task and subject, desk illustration, rotating motivational lines, Pause/Resume, End early (keeps the time), Cancel, and a minimise button that keeps the timer running.

**Break screen:** countdown, sleeping-cat illustration, rotating rest suggestions (stretch, drink water, rest your eyes…), Pause, **Skip**, **Extend +5 min** (Premium, up to twice), and a "Next up" card.

**Reliability:** the timer is calculated from server timestamps, so it **survives refreshes, closed tabs and locked phones**. A focus that finishes while the app is closed is completed and rolls into the break automatically. A session paused for more than **15 minutes is cancelled automatically**.

**Extras:** keeps the screen awake while docked (Wake Lock), plays a chime and vibrates when a session ends, shows a browser notification if the app is in the background, briefly shows a *Session complete* screen with the minutes recorded, and offers an auto-start-break setting and a daily session goal.

**Study sounds** (generated in the browser, no audio files). Every sound is a steady, softly filtered background noise designed not to pull attention: no melodies, birdsong, crackles or sudden changes in volume.
- Free: **Rain** (muffled, steady rain with no droplet clicks) · **Brown noise** (deep, smooth) · **Thunderstorm** (heavy, steady rain with thunder rolling far away)
- Premium: + **Ocean waves** (distant surf with a slow, shallow swell) · **Forest** (leaves in a light breeze, no birdsong) · **Fireplace** (warm, low fire without crackles) · **Fan** (even airflow without electrical hum) · **Riverside** (a stream flowing over stones)
- **Thunderstorm** and **Riverside** replaced *White noise* and *Pink noise*, keeping the same tiers (Thunderstorm is free, as White noise was; Riverside is Premium, as Pink noise was).
  - Thunderstorm has no sharp thunder cracks. The thunder is a deep, low rumble that swells and fades slowly and irregularly, never suddenly.
  - Riverside is a soft water wash with a gentle babble whose tone moves slowly.
  - Database migration `002_study_sounds_thunderstorm_riverside` updates the allowed sound names. Anyone whose saved sound was White or Pink noise is moved to Rain, and the API now rejects the old names.
  - On small phones the tile label breaks as *Thunder-storm* so it stays inside its tile.
- Sounds fade in when started and fade out when paused or switched, and loop seamlessly with no click at the loop point
- Play/pause and volume, remembered between visits

**Spotify:** save up to 5 playlist or album links, play them in Spotify's official embed player, and open them in the Spotify app.

**History & statistics:** session list with status (completed / ended early / cancelled). Premium adds completed count, total minutes, average, longest session and completion rate.

### Feature 4: Assignment & deadline tracker
- Task fields: **title, type, subject, due date + time, effort, description, status**
- **Types:** Quiz · Report · Project · Exam · Assignment · Other
- **Effort:** Light (under 1 hour) · Moderate (1 to 3 hours) · Heavy (over 3 hours), each with its own colour
- **Statuses:** Pending · In progress · Completed · **Overdue** (set automatically once the deadline passes)
- **Fast "Add Assignment" form:** type chips, subject picker, date presets (**Today, Tomorrow, This week, Next week**) or a calendar, plus time, effort and an optional description
- **Voice task creation:** say *"Programming project due next Friday with large effort"*. The app fills in title, type, subject, date, time and effort, you review, and **nothing is saved until you tap Save**. Typing the sentence works the same way.
- **Subjects:** add, edit or delete subjects with a colour and icon, plus 13 quick-pick presets (Mathematics, Science, Programming, Data Structures, Embedded Systems…)
- **Checklist / progress:** break a task into steps, with a progress bar and percentage
- Task details: status switcher, edit, delete (with confirmation), activity history, focus time
- **Priority dots** (high/medium) based on how close the deadline is and the effort
- Search, status filters, type filter, and quick-complete checkboxes with an animation
- **Academic calendar:** week and month views, deadline dots, and per-day lists
- **Limits**
  - Freemium (stand owners only): **3 open tasks** at a time (completing or deleting one frees a slot; completed tasks stay visible)
  - Premium: **unlimited**, plus filtering and sorting by **subject** and **effort**
  - After Premium ends, all tasks are kept and can still be edited or completed, but you can't go above 3 open tasks

### Feature 5: Summary page & data export
**Overview tiles:** focus time, focus sessions, tasks completed, completion rate, pending and overdue tasks, missed deadlines (each with a change versus the previous period on Premium).

**Charts:** daily focus minutes (stand owners) or tasks completed per day, with a goal line and the best day highlighted; focus by subject; progress by subject; a task-type donut; mood insights.

**Insights** written from real data only, for example:
- *"You completed 3 focus sessions this week, for 75 minutes of focus."*
- *"Data Structures accounted for most of your recorded study time (60%)."*
- *"You completed more tasks than in the previous period (5 vs 2)."*

| | Freemium | Premium |
|---|---|---|
| Range | This week | Week · Month · **Custom range** |
| Comparisons, subject & type breakdowns | ❌ | ✅ |
| Mood insights | ❌ | ✅ (stand owners) |
| Exports | ❌ | ✅ |

**Exports** (Premium, choose a date range):
| Export | Formats |
|---|---|
| Full activity report | PDF |
| Productivity summary | PDF, CSV |
| Tasks | CSV |
| Focus sessions (stand owners) | CSV |
| Mood check-ins (Premium stand owners) | CSV |

Exports are logged, and the PDF report is a branded ATHENTIV FocusDock document.

### Extra features
- **Home dashboard:** greeting, NFC status banner, a resume card for a running session, a *Today's Progress* ring, quick actions, today's check-in, *For you* suggestions, today's tasks with **Start** buttons, and an overdue alert
- **Personalised suggestions** based on real data (overdue tasks, an exam coming up with no focus time yet, a small task to start with after a stressed check-in, your busiest subject)
- **Study streaks:** current and best streak; a study day counts when you complete a task or record focus time
- **10 achievements:** First step, Getting things done, Unstoppable, Ahead of schedule, On a roll, Week warrior, Deep diver, Focus regular, Ten-hour club, Self-aware
- **Notification inbox:** due-soon reminders, overdue alerts, Premium ending or ended, daily recap and achievements, each switchable on or off (including how far ahead reminders arrive)
- **Notification style:** in-app pop-ups, inbox messages and browser notifications use short, plain text with no emojis and no exclamation marks (for example *"Task completed"*, *"Premium activated"*, *"Focus session complete: Your focus time has been saved."*). Each pop-up keeps its icon, timing and dismissal
- **Dark mode:** a **Dark mode** switch in **Profile → Settings** changes the whole app (pages, cards, buttons, forms, sheets, pop-ups, charts) between light and dark immediately. The choice is saved on the phone, applies on the next visit without a flash of the light theme, and doesn't change any account data or other settings. Light mode is the default
- **Installable:** can be added to the home screen (web app manifest)

### Landing page (`/welcome`)
The first screen signed-out visitors see (`/` redirects here; signed-in users go to Home instead). It is for people who may not have an account or a stand yet, so it shows **only generic product content**: no names, avatars, tasks, progress, statistics, greetings, notifications or session information. A signed-in user who opens `/welcome` directly sees the same public page, and their session is not affected.
- **Sticky top bar:** the FocusDock logo (returns to the landing page), **Features** (scrolls to the feature cards), **Manual** (opens the user manual) and **Sign in** (`/login`). On phones narrower than 380 px the logo shows without the name so the bar always fits.
- **Hero panel:** a large rounded panel with a soft brand-blue tint that fades into the card colour (`.hero-panel` in `globals.css`; a darker version in Dark mode). Inside it, centred: a small pill label (*For students · Tasks, focus and calm sounds*), the headline *"Plan your schoolwork. Study with focus."*, one line of description, then **Get started** (opens *Create account*, `/register`) and **User manual** (`/manual`) directly beneath it, plus a line telling stand owners they can tap their stand to sign in. The hero fills the screen below the top bar (`.hero-fill`: the viewport height minus the bar and the safe area) and the panel centres its content vertically, so the value proposition and both buttons are the first thing visible on any screen size, with no fixed top margin. The earlier illustration below the buttons has been removed, and nothing was added in its place.
- **Features:** a centred section header (a small *Features* pill label, the heading *"Everything for a focused study day"* and one line of text), then four cards with an icon tile: Tasks & deadlines, Focus timer, Study sounds and FocusDock stand. A note says the timer, sounds and check-ins come with the stand.
- The layout borrows patterns from a modern landing-page reference (hero panel, pill labels above headings, centred section headers, icon cards) but keeps FocusDock's own font, colours and buttons. No new colours, fonts or sections were added.
- **Footer:** name, a User manual link and © 2026 ATHENTIV.
- A `?next=` destination is kept when moving on to Sign in or Get started, so users return where they were headed.
- Uses the existing font (Inter), colours, buttons, card radii and shadows, and follows Light/Dark mode. Checked at 360, 375, 390, 412 and 430 px wide with no sideways scrolling. Like the rest of the app it is phone-only: laptops and tablets see the "designed exclusively for smartphones" screen.
- NFC sign-in is unchanged: stand tags still open `/nfc/...` directly.

### User manual (`/manual`)
One manual for everyone, on a public page (no sign-in needed).
- **Two ways in:** visitors open it from the landing page (top bar, hero button and footer). Signed-in users open it from the **User manual** row in **Profile → Settings**, without going back to the landing page. Both lead to the same page, so there is no second copy to keep in sync. The back arrow goes to `/`, which leads to Home when signed in and to the landing page when not.
- **Page layout:** a short intro (a *Guide* pill label, *"How to use FocusDock"* and one line of text), then an **In this manual** card: a two-column grid of section links, each with its icon, that jumps to the section.
- **Sections:** Getting started (with a stand, and without one), Signing in with the stand, Home and Profile, Tasks and deadlines, Focus timer, Study sounds, Mood check-in, Summary and exports, Plans, and Troubleshooting.
- **Section design, kept uncrowded:** each section is its own card with an icon tile, a title and a one-line summary. The content is split into small labelled groups (for example *Add a task* and *Good to know*), separated by a divider.
  - Numbered steps sit on a soft background panel, with round brand-blue number circles.
  - "Good to know" points use small check marks.
  - Both markers are drawn in CSS (`.manual-steps` and `.manual-tips` in `globals.css`). There are no emoji anywhere.
  - Line spacing and the gaps between items, groups and sections were increased. The font size was not reduced and no instructions were removed.
- **Screenshots:** real app screenshots, taken at 390 px wide from a demo account, appear in Home and Profile (Home after a stand tap), Tasks (the Add task form), Focus timer (presets and task picker) and Study sounds (the sounds sheet).
  - Each comes in a light and a dark version that follows the app's theme, is shown in a rounded frame with a caption, and lazy-loads.
  - The Home shot starts below the greeting, so no name is shown.
  - The files are `public/manual/<name>-light.webp` and `-dark.webp`. Retake them when those screens change.
- **Troubleshooting** is a list of expandable questions (tap to open; the + turns into ×). It covers: stand tap not working, verification ended, session expired, sign-in paused, the smartphones-only screen, no sound, and offline.
- **Design:** built from the app's own pieces: page header, cards, Inter, the brand colours and Lucide icons. It follows Light/Dark mode.
- Limits in the text (open tasks, daily sessions) are read from `src/shared/limits.ts`, so they stay correct if the limits change.

---

## 5. Freemium vs Premium

| Feature | Freemium | Premium |
|---|---|---|
| Avatars | 4 | All 8 |
| Open tasks | 3 | Unlimited |
| Filter / sort by subject & effort | ❌ | ✅ |
| Summary | This week | Week, month, custom + comparisons |
| CSV / PDF exports | ❌ | ✅ |
| Pomodoro presets *(stand)* | 25/5 | 25/5, 50/10, custom |
| Focus sessions per day *(stand)* | 4 | Unlimited |
| Session history *(stand)* | Last 5 | Last 20 + stats |
| Ambient sounds *(stand)* | 3 | 8 |
| Break extension *(stand)* | ❌ | ✅ |
| Task focus history *(stand)* | Total minutes | Per-session list |
| Mood check-in *(stand)* | ✅ | ✅ |
| Mood history & trends *(stand)* | ❌ | ✅ |

*(stand)* = needs a FocusDock stand; Premium alone doesn't unlock it.

### Proposed pricing (Philippine pesos)
| Plan | Price | Per month |
|---|---|---|
| Weekly Premium | **₱29** / 7 days | ≈ ₱126 |
| Monthly Premium | **₱99** / month | ₱99 *(Popular)* |
| Annual Premium | **₱799** / year | ≈ ₱67 *(Save 33%)* |

- Buying while Premium is active **adds the new period after the current expiry date**.
- When Premium ends, the account drops to Freemium immediately, and **all data is kept**.
- **Checkout:** shows the plan, amount and reference with **Confirm payment** and **Cancel**. No payment gateway is connected yet, so confirming activates the plan without charging any money (the transaction is still recorded internally as a sandbox payment). Test-mode notices, "test payment" labels and the *Simulate failed payment* option are no longer shown.

---

## 6. Screens

| Area | Screens |
|---|---|
| Public | Landing page · User manual · Sign in · Create account · Reset password · NFC stand landing · Session expired · Offline · Unsupported device · Not found · Error |
| Main tabs | Home · Tasks · Focus *(stand)* or Calendar *(non-stand)* · Summary · Profile |
| Tasks | Task list · Add assignment (with voice) · Task details · Edit task · Subjects · Calendar |
| Focus *(stand)* | Focus Timer setup · Active focus session · Break · Session history · Study sounds & Spotify |
| Wellbeing *(stand)* | Check-in · Mood history |
| Account | Onboarding · Profile (with the Dark mode switch) · Edit profile · Avatar picker · Achievements · Account & security · Notification settings · Notifications inbox · My stand & session |
| Premium | Plans & comparison · Checkout · Billing history |
| Summary | Summary dashboard · Export data |

Every screen has loading, empty and error states. Locked features show a lock and an upgrade prompt instead of acting as if they're available.

---

## 7. Security & privacy

- Passwords are **hashed with scrypt** and never stored in plain text. Recovery codes and NFC tag secrets are stored only as hashes.
- Session cookies can't be read by page scripts or sent from other websites, and are HTTPS-only on the live site.
- **Every permission check happens on the server** (Premium, stand-owner, NFC, task limits); hiding a button is never the only protection.
- Each user can only reach their own data. Another user's records simply appear as "not found".
- Requests from other websites are rejected (CSRF protection), and all input is validated on the server.
- **Login lockout** after 5 failed attempts, plus rate limits on sign-in, registration, recovery, NFC, checkout and exports.
- CSV exports are protected so a malicious cell can't run as a spreadsheet formula.
- Security headers stop the site being embedded in other pages, and it only uses the microphone (for voice input).
- Mood data is treated as private and isn't presented as a diagnosis.

---

## 8. How it's built

| Layer | Technology |
|---|---|
| Frontend & backend | **Next.js 16** (React 19, App Router + API routes), TypeScript, Tailwind CSS v4 |
| Database | **Turso** (hosted libSQL/SQLite) in production; a local SQLite file in development |
| Hosting | **Vercel**, server functions in Tokyo (`hnd1`), close to the Philippines |
| Validation / icons | zod · lucide-react |
| Built in-house | password hashing, charts, PDF generator, ambient-sound engine, voice/text task parser |

**Database:** 26 tables with keys, constraints, indexes and versioned migrations, covering users, profiles, avatars, phone stands, stand assignments, devices, sessions, NFC verifications, subscription plans, subscriptions, transactions, subjects, tasks, checklists, task history, mood check-ins, Pomodoro sessions and settings, audio preferences, Spotify links, notifications, daily summaries, export requests, achievements, login attempts and preferences.

**Admin tools** (run from the ATHENTIV PC against the live database):
```bash
pnpm stand:create FD-2001 username "Name"   # new stand + premade owner account
pnpm stand:list                             # all stands, owners, trial status
pnpm stand:rotate FD-2001                   # new NFC secret (old tag stops working)
pnpm stand:disable FD-2001 / stand:enable
pnpm db:migrate                             # apply database migrations
```

---

## 9. Testing

- An automated end-to-end suite covers the 18 required scenarios: **165 checks, all passing**. It covers registration, login, NFC sign-in, the one-time trial, the one-device rule, task limits, Pomodoro limits and timer recovery, subscription expiry, stand-only restrictions, mood persistence, summary accuracy, exports, device blocking and data isolation.
- The live site was checked: phones load it, desktops are blocked, and stand links resolve against the live database.
- Dark and light mode, the sign-up → plan → checkout flow, the *Task completed* pop-up and the Study sounds sheet were checked in an emulated phone browser (390 × 844).
- **Recovery code copy** was checked in an emulated phone browser:
  - On an insecure address (`http://<LAN IP>`): the clipboard held exactly the code.
  - On a secure address: the code was copied through the Clipboard API.
  - With copying blocked: the code was selected and *Save as file* appeared.
- **Thunderstorm and Riverside** were checked to appear, play (the audio clock was running), save as the user's choice and keep pause and volume working. The API accepts the new names and rejects the old ones.
- The **check-in intensity buttons** were checked to have equal side padding at 360, 390 and 430 px.
- Details: `docs/TESTING.md`.

---

## 10. Current limitations

- **Payments:** no real gateway (for example PayMongo) is connected yet. Checkout activates plans without charging, even though test-mode labels are no longer shown.
- **Push notifications:** reminders appear in the in-app inbox and as browser notifications while the app is open, but not when it's fully closed.
- **Spotify:** saved links plus the official embed player, not full in-app playback control (Spotify's API restricts that).
- **Web NFC in-app scan:** Android Chrome only. iPhones use the tag's link instead, which works.
- Some phone-only features (NFC scan, keeping the screen awake, voice input, vibration) still need manual testing on real devices.

---

## 11. More documentation

| File | Contents |
|---|---|
| `README.md` | Setup, local development, project structure |
| `docs/DEPLOY-VERCEL.md` | Going live: GitHub → Turso → Vercel → creating stands → signing in on a phone |
| `docs/ACCESS-RULES.md` | Account rules, NFC design, feature matrix, assumptions |
| `docs/SUBSCRIPTION.md` | Pricing rationale and payment architecture |
| `docs/TESTING.md` | Automated and manual testing |
| `docs/RECOMMENDATIONS.md` | Future feature ideas and specification notes |
