// End-to-end API test suite for the scenarios in docs/TESTING.md.
//
//   1. Start the server against a test database:
//        DATABASE_PATH=data/test.db pnpm start        (or pnpm dev)
//   2. In another terminal:
//        DATABASE_PATH=data/test.db BASE_URL=http://localhost:3000 pnpm test:api
//
// The suite provisions its own stands/users (random names), so it can be re-run safely. To
// simulate the passage of time it shifts stored timestamps directly in the shared database.
import { randomBytes } from "node:crypto";
import { openDb, provisionStand } from "./lib.mjs";

const BASE = (process.env.BASE_URL || "http://localhost:3000").replace(/\/$/, "");
const HOST = new URL(BASE).host;
const IPHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1";
const ANDROID = "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Mobile Safari/537.36";
const { db } = await openDb();
const tag = randomBytes(3).toString("hex").toUpperCase();
const DAY = 86_400_000;

let passed = 0;
const failures = [];
let section = "";
function group(name) {
  section = name;
  console.log(`\n▶ ${name}`);
}
function check(name, cond, detail) {
  if (cond) {
    passed++;
    console.log(`  ✓ ${name}`);
  } else {
    failures.push(`${section} — ${name}${detail !== undefined ? `  (${typeof detail === "string" ? detail : JSON.stringify(detail).slice(0, 300)})` : ""}`);
    console.log(`  ✗ ${name}${detail !== undefined ? `  → ${typeof detail === "string" ? detail : JSON.stringify(detail).slice(0, 300)}` : ""}`);
  }
}

/** A phone: keeps its own cookies (device + session), like a real browser. */
class Phone {
  constructor(ua = IPHONE) {
    this.ua = ua;
    this.cookies = new Map();
  }
  async req(method, path, body, extraHeaders = {}) {
    const headers = { "User-Agent": this.ua, Cookie: [...this.cookies].map(([k, v]) => `${k}=${v}`).join("; "), ...extraHeaders };
    if (method !== "GET") headers.Origin = headers.Origin ?? BASE;
    if (body !== undefined) headers["Content-Type"] = "application/json";
    const res = await fetch(BASE + path, { method, headers, body: body !== undefined ? JSON.stringify(body) : undefined, redirect: "manual" });
    for (const c of res.headers.getSetCookie?.() ?? []) {
      const [pair, ...attrs] = c.split(";");
      const [k, ...v] = pair.split("=");
      const expired = attrs.some((a) => /max-age=0/i.test(a) || /expires=Thu, 01 Jan 1970/i.test(a));
      if (expired || v.join("=") === "") this.cookies.delete(k.trim());
      else this.cookies.set(k.trim(), v.join("="));
    }
    const type = res.headers.get("content-type") ?? "";
    const data = type.includes("json") ? await res.json() : type.includes("text") ? await res.text() : Buffer.from(await res.arrayBuffer());
    return { status: res.status, data, headers: res.headers };
  }
  get = (p) => this.req("GET", p);
  post = (p, b = {}) => this.req("POST", p, b);
  patch = (p, b) => this.req("PATCH", p, b);
  put = (p, b) => this.req("PUT", p, b);
  del = (p) => this.req("DELETE", p);
}

const code = (r) => r.data?.error?.code;
const userId = async (username) => (await db.get("SELECT id FROM users WHERE username = ?", username)).id;
const due = (days) => Date.now() + days * DAY;
const task = (title, extra = {}) => ({ title, type: "assignment", subjectId: null, dueAt: due(3), effort: "M", ...extra });

// ---------------------------------------------------------------------------
console.log(`ATHENTIV FocusDock API tests → ${BASE}  (run ${tag})`);
const health = await fetch(BASE + "/welcome", { headers: { "User-Agent": IPHONE } }).catch(() => null);
if (!health) {
  console.error(`Server not reachable at ${BASE}. Start it first (see header of this file).`);
  process.exit(2);
}

const ownerA = await provisionStand(db, { code: `FD-A${tag}`, username: `own_a_${tag}`.toLowerCase(), password: "TempPass111", displayName: "Owner A" });
const ownerB = await provisionStand(db, { code: `FD-B${tag}`, username: `own_b_${tag}`.toLowerCase(), password: "TempPass222", displayName: "Owner B" });
const proofA = { code: ownerA.code, key: ownerA.secret };
const proofB = { code: ownerB.code, key: ownerB.secret };

// 1 ─────────────────────────────────────────────────────────────────────────
group("1. New non-stand user registration");
const s1 = new Phone(ANDROID);
const s1name = `stu_${tag}`.toLowerCase();
let r = await s1.post("/api/auth/register", { username: s1name, password: "weak", displayName: "Student" });
check("weak password rejected", r.status === 400 && code(r) === "VALIDATION", r.data);
r = await s1.post("/api/auth/register", { username: s1name, password: "Student2026", displayName: "Student", timezone: "Asia/Manila" });
check("registration succeeds (201)", r.status === 201, r.data);
check("recovery code returned once", /^[A-Z0-9]{4}(-[A-Z0-9]{4}){3}$/.test(r.data.recoveryCode ?? ""), r.data);
const s1Recovery = r.data.recoveryCode;
r = await s1.get("/api/me");
check("account is a standard (non-stand) account", r.data.user?.accountType === "standard", r.data.user);
check("starts without a plan", r.data.access?.isPremium === false && r.data.access?.subscriptionRequired === true, r.data.access);
check("stored password is hashed (scrypt), never plain text", /^scrypt\$/.test((await db.get("SELECT password_hash FROM users WHERE username = ?", s1name)).password_hash));
r = await new Phone().post("/api/auth/register", { username: s1name.toUpperCase(), password: "Student2026", displayName: "Dup" });
check("duplicate username rejected (case-insensitive)", r.status === 409 && code(r) === "USERNAME_TAKEN", r.data);
await s1.patch("/api/profile", { onboarded: true });
for (const [m, path, body] of [["get", "/api/tasks"], ["post", "/api/tasks", task("No plan yet")], ["get", "/api/dashboard"], ["get", "/api/subjects"], ["get", "/api/summary"]]) {
  r = await s1[m](path, body);
  check(`no plan → ${m.toUpperCase()} ${path} refused (SUBSCRIPTION_REQUIRED)`, r.status === 403 && code(r) === "SUBSCRIPTION_REQUIRED", r.data);
}
r = await s1.get("/api/billing");
check("no plan → can still open billing to subscribe", r.status === 200 && r.data.plans?.length === 3, r.status);

// 2 ─────────────────────────────────────────────────────────────────────────
group("2. Existing user login");
await s1.post("/api/auth/logout");
r = await s1.get("/api/me");
check("logged out → 401", r.status === 401);
r = await s1.post("/api/auth/login", { username: s1name, password: "wrong-pass-1" });
check("wrong password → 401 INVALID_CREDENTIALS", r.status === 401 && code(r) === "INVALID_CREDENTIALS", r.data);
r = await s1.post("/api/auth/login", { username: s1name, password: "Student2026" });
check("correct password → 200", r.status === 200, r.data);
r = await s1.get("/api/me");
check("session works after login", r.status === 200 && r.data.user.username === s1name);
const lockName = `lock_${tag}`.toLowerCase();
await new Phone().post("/api/auth/register", { username: lockName, password: "LockTest123", displayName: "L" });
const locker = new Phone();
for (let i = 0; i < 5; i++) await locker.post("/api/auth/login", { username: lockName, password: "nope-nope-1" });
r = await locker.post("/api/auth/login", { username: lockName, password: "LockTest123" });
check("5 failed attempts lock the account temporarily (429)", r.status === 429, r.status);
r = await new Phone().post("/api/auth/recover", { username: s1name, recoveryCode: "AAAA-BBBB-CCCC-DDDD", newPassword: "Another2026" });
check("password recovery rejects a wrong code", r.status === 401, r.data);

// 3 + 4 ─────────────────────────────────────────────────────────────────────
group("3. Stand-owner NFC login  /  4. First tap grants 30-day Premium");
const a1 = new Phone(IPHONE);
r = await a1.post("/api/nfc/verify", { code: ownerA.code, key: "forged-key-123" });
check("forged tag key rejected", r.status === 404, r.data);
r = await a1.post("/api/nfc/verify", proofA);
check("signed-out tap → login_required with owner username", r.data.status === "login_required" && r.data.username === ownerA.username, r.data);
r = await a1.post("/api/auth/login", { username: ownerA.username, password: ownerA.password, nfc: proofA });
check("login with stand proof verifies NFC", r.status === 200 && r.data.nfc?.ok === true && r.data.nfc.newSession === true, r.data);
check("premade account must change temporary password", r.data.mustChangePassword === true);
check("first verified tap grants the trial", r.data.nfc?.trialGranted === true, r.data.nfc);
r = await a1.get("/api/me");
check("me: stand owner, NFC verified", r.data.access?.standOwner && r.data.access.nfc.verified, r.data.access?.nfc);
const until = r.data.access?.premium?.until ?? 0;
check("Premium active from trial, ~30 days", r.data.access?.isPremium && r.data.access.premium.source === "trial" && Math.abs(until - (Date.now() + 30 * DAY)) < 120_000, r.data.access?.premium);
const verificationA = (await a1.post("/api/nfc/verify", proofA)).data;
r = await a1.post("/api/auth/password", { currentPassword: ownerA.password, newPassword: "OwnerA2026x" });
check("owner changes temporary password", r.status === 200, r.data);
await a1.patch("/api/profile", { onboarded: true });

// 5 ─────────────────────────────────────────────────────────────────────────
group("5. Repeated NFC tap does not grant another trial");
check("second tap on same session renews, no trial", verificationA.status === "verified" && verificationA.trialGranted === false && verificationA.newSession === false, verificationA);
await a1.post("/api/auth/logout");
await a1.post("/api/auth/login", { username: ownerA.username, password: "OwnerA2026x" });
r = await a1.post("/api/nfc/verify", proofA);
check("tap after re-login: new NFC session, still no trial", r.data.newSession === true && r.data.trialGranted === false, r.data);
const trials = (await db.get("SELECT COUNT(*) AS n FROM user_subscriptions WHERE user_id = ? AND source = 'trial'", (await userId(ownerA.username)))).n;
check("exactly one trial period in the database", trials === 1, trials);
let dup = null;
try {
  (await db.run("INSERT INTO user_subscriptions (user_id, plan_code, source, starts_at, ends_at, created_at) VALUES (?, 'trial', 'trial', 1, 2, 1)", (await userId(ownerA.username))));
} catch (e) {
  dup = e;
}
check("database unique index blocks a second trial row", dup && /UNIQUE/.test(dup.message));

// 6 ─────────────────────────────────────────────────────────────────────────
group("6. Simultaneous login from another device");
const a2 = new Phone(ANDROID);
r = await a2.post("/api/auth/login", { username: ownerA.username, password: "OwnerA2026x", nfc: proofA });
check("second phone signs in", r.status === 200 && r.data.nfc?.ok, r.data);
r = await a1.get("/api/me");
check("first phone is signed out with SESSION_REPLACED", r.status === 401 && code(r) === "SESSION_REPLACED", r.data);
r = await a2.get("/api/sessions");
check("only one active session remains", r.data.sessions?.length === 1, r.data);
const s1b = new Phone(IPHONE);
await s1b.post("/api/auth/login", { username: s1name, password: "Student2026" });
r = await s1.get("/api/me");
check("standard accounts may use several devices", r.status === 200);

// 7 ─────────────────────────────────────────────────────────────────────────
group("7. Manual login without NFC verification");
const b1 = new Phone(IPHONE);
r = await b1.post("/api/auth/login", { username: ownerB.username, password: ownerB.password });
check("owner B signs in manually", r.status === 200);
r = await b1.get("/api/me");
check("not NFC-verified", r.data.access?.nfc?.verified === false);
r = await b1.post("/api/pomodoro/start", { preset: "25/5" });
check("Pomodoro blocked → NFC_REQUIRED", r.status === 403 && code(r) === "NFC_REQUIRED", r.data);
r = await b1.post("/api/checkins", { mood: "good", mindset: "ready" });
check("Check-in blocked → NFC_REQUIRED", r.status === 403 && code(r) === "NFC_REQUIRED", r.data);
r = await b1.get("/api/stand");
check("Stand page info still viewable by the owner", r.status === 200 && r.data.nfc?.verified === false, r.data);
check("no trial before the first tap", r.data.trialGrantedAt === null);

// 8 ─────────────────────────────────────────────────────────────────────────
group("8. Freemium task limit (stand owner without Premium)");
const ids = [];
for (let i = 1; i <= 3; i++) {
  r = await b1.post("/api/tasks", task(`Free task ${i}`));
  ids.push(r.data.task?.id);
  check(`open task ${i} created`, r.status === 201, r.data);
}
r = await b1.post("/api/tasks", task("Free task 4"));
check("4th open task rejected (TASK_LIMIT, server-side)", r.status === 403 && code(r) === "TASK_LIMIT", r.data);
r = await b1.post(`/api/tasks/${ids[0]}/status`, { status: "completed" });
check("completing a task frees a slot", r.status === 200 && r.data.task.status === "completed");
r = await b1.post("/api/tasks", task("Free task 4"));
check("now a new task can be created", r.status === 201, r.data);
ids.push(r.data.task?.id);
r = await b1.post(`/api/tasks/${ids[0]}/status`, { status: "pending" });
check("re-opening a completed task respects the limit", r.status === 403 && code(r) === "TASK_LIMIT", r.data);
r = await b1.del(`/api/tasks/${ids[1]}`);
check("deleting an open task frees a slot", r.status === 200);
r = await b1.get("/api/tasks?status=all");
check("completed tasks stay accessible", r.data.items.some((t) => t.id === ids[0] && t.status === "completed") && r.data.openCount === 2, { open: r.data.openCount });
r = await b1.get("/api/tasks?effort=L");
check("advanced filter (effort) blocked on Freemium", r.status === 403 && code(r) === "PREMIUM_REQUIRED", r.data);
r = await b1.get("/api/tasks?sort=subject");
check("advanced sort blocked on Freemium", r.status === 403);
r = await b1.post("/api/tasks", task("Bad", { dueAt: "tomorrow" }));
check("invalid input → 400 VALIDATION", r.status === 400 && code(r) === "VALIDATION", r.data);
r = await b1.get(`/api/tasks?q=${encodeURIComponent("' OR 1=1 --")}`);
check("SQL-injection-looking search is treated as text", r.status === 200 && r.data.items.length === 0, r.data);
r = await b1.req("POST", "/api/tasks", task("csrf"), { Origin: "https://evil.example" });
check("cross-origin POST blocked (CSRF)", r.status === 403 && code(r) === "CSRF", r.data);
r = await b1.post(`/api/tasks/${ids[2]}/status`, { status: "in_progress" });
check("status → in progress", r.data.task?.status === "in_progress");
await b1.patch(`/api/tasks/${ids[2]}`, { dueAt: Date.now() - 3_600_000 });
r = await b1.get(`/api/tasks/${ids[2]}`);
check("past deadline → derived status Overdue", r.data.task?.status === "overdue", r.data.task?.status);
check("status history recorded", r.data.history?.length >= 2, r.data.history);

// 9 + 12 ────────────────────────────────────────────────────────────────────
group("9. Premium unlimited tasks  /  12. Subscription purchase, extension & expiration");
r = await s1.post("/api/billing/checkout", { plan: "monthly" });
check("sandbox checkout created", r.status === 201 && r.data.checkoutUrl, r.data);
const txn = r.data.id;
r = await s1.post(`/api/billing/sandbox/${txn}`, { outcome: "success" });
check("sandbox payment marked paid & test-only", r.data.transaction?.status === "paid" && r.data.transaction.isTest === true, r.data);
const firstUntil = r.data.premium.until;
r = await s1.post(`/api/billing/sandbox/${txn}`, { outcome: "success" });
check("settling the same payment twice does not add time", r.data.premium.until === firstUntil);
r = await s1.post("/api/billing/checkout", { plan: "weekly" });
r = await s1.post(`/api/billing/sandbox/${r.data.id}`, { outcome: "success" });
check("buying while active extends the expiry by the new period", r.data.premium.until - firstUntil === 7 * DAY, { firstUntil, now: r.data.premium.until });
r = await s1.post("/api/billing/checkout", { plan: "annual" });
r = await s1.post(`/api/billing/sandbox/${r.data.id}`, { outcome: "failure" });
check("failed payment grants nothing", r.data.transaction.status === "failed" && r.data.premium.until === firstUntil + 7 * DAY);
for (let i = 1; i <= 5; i++) {
  r = await s1.post("/api/tasks", task(`Premium task ${i}`, { effort: "L" }));
}
r = await s1.get("/api/tasks?status=open");
check("Premium: more than 3 open tasks allowed", r.data.openCount === 5 && r.data.maxOpen === null, { open: r.data.openCount });
r = await s1.get("/api/tasks?effort=L&sort=effort");
check("Premium: advanced filter & sort work", r.status === 200 && r.data.items.every((t) => t.effort === "L"));
r = await s1.patch("/api/profile", { avatarKey: "robot" });
check("Premium avatar allowed while Premium", r.status === 200 && r.data.profile.avatarKey === "robot");
const tasksBeforeExpiry = (await s1.get("/api/tasks?status=all")).data.items.length;
// Expire Premium by moving every period into the past.
const s1id = (await userId(s1name));
(await db.run("UPDATE user_subscriptions SET starts_at = starts_at - 400 * 86400000, ends_at = ? WHERE user_id = ?", Date.now() - 1000, s1id));
r = await s1.get("/api/me");
check("expired → plan required again immediately", r.data.access?.isPremium === false && r.data.access?.subscriptionRequired === true, r.data.access?.premium);
r = await s1.get("/api/tasks?status=all");
check("expired non-stand account can't use tasks", r.status === 403 && code(r) === "SUBSCRIPTION_REQUIRED", r.data);
const keptTasks = (await db.get("SELECT COUNT(*) AS n FROM tasks WHERE user_id = ?", s1id)).n;
check("all tasks kept in the database after expiry", keptTasks === tasksBeforeExpiry, { before: tasksBeforeExpiry, kept: keptTasks });
r = await s1.get("/api/summary?range=month");
check("analytics locked after expiry", r.status === 403);
r = await s1.get("/api/export?kind=tasks&format=csv&from=2026-01-01&to=2026-12-31");
check("exports locked after expiry", r.status === 403);
r = await s1.patch("/api/profile", { avatarKey: "frog" });
check("Premium avatars locked after expiry", r.status === 403);
r = await s1.get("/api/notifications");
check("'Premium has ended' notification created", r.data.items?.some((n) => n.kind === "subscription" && /ended/i.test(n.title)), r.data.items?.map((n) => n.title));

// 10 ────────────────────────────────────────────────────────────────────────
group("10. Pomodoro session limits (Freemium stand owner)");
r = await b1.post("/api/nfc/verify", proofB);
check("owner B taps the stand (gets trial)", r.data.status === "verified" && r.data.trialGranted === true, r.data);
const bId = (await userId(ownerB.username));
(await db.run("UPDATE user_subscriptions SET starts_at = starts_at - 40 * 86400000, ends_at = ? WHERE user_id = ?", Date.now() - 1000, bId));
r = await b1.get("/api/pomodoro/state");
check("trial expired → Freemium limits apply", r.data.today?.limit === 4, r.data.today);
r = await b1.get("/api/tasks?status=open");
const bOpen = r.data.openCount;
check("stand owner keeps using the app on Freemium after the trial", r.status === 200 && bOpen === 2, { open: bOpen });
r = await b1.post("/api/tasks", task("After trial"));
check("…can open a 3rd task", r.status === 201, r.data);
r = await b1.post("/api/tasks", task("After trial 2"));
check("…but not a 4th (TASK_LIMIT)", r.status === 403 && code(r) === "TASK_LIMIT", r.data);
r = await b1.patch(`/api/tasks/${ids[3]}`, { title: "Edited after trial" });
check("…and existing tasks can still be edited", r.status === 200 && r.data.task.title === "Edited after trial");
r = await b1.post("/api/pomodoro/start", { preset: "50/10" });
check("50/10 preset blocked on Freemium", r.status === 403 && code(r) === "PREMIUM_REQUIRED", r.data);
r = await b1.post("/api/pomodoro/start", { preset: "custom", focusMinutes: 40, breakMinutes: 5 });
check("custom duration blocked on Freemium", r.status === 403);
for (let i = 1; i <= 4; i++) {
  r = await b1.post("/api/pomodoro/start", { preset: "25/5" });
  const id = r.data.live?.id;
  check(`free session ${i} starts (25/5)`, r.status === 201 && r.data.live?.kind === "focus" && r.data.live.plannedSeconds === 1500, r.data);
  r = await b1.post(`/api/pomodoro/${id}`, { action: "end_early" });
  if (r.data.live?.kind === "break") await b1.post(`/api/pomodoro/${r.data.live.id}`, { action: "skip" });
}
r = await b1.post("/api/pomodoro/start", { preset: "25/5" });
check("5th session of the day → DAILY_LIMIT", r.status === 403 && code(r) === "DAILY_LIMIT", r.data);
r = await b1.get("/api/pomodoro/history");
check("Freemium history: ≤5 sessions, no statistics", r.data.limit === 5 && r.data.items.length <= 5 && r.data.stats === null, { limit: r.data.limit, stats: r.data.stats });
r = await b1.patch("/api/audio", { soundKey: "ocean" });
check("Premium ambient sound blocked on Freemium", r.status === 403);
r = await b1.patch("/api/audio", { soundKey: "brown", volume: 0.4 });
check("free ambient sound saved", r.status === 200 && r.data.soundKey === "brown" && r.data.volume === 0.4);

// 11 ────────────────────────────────────────────────────────────────────────
group("11. Pomodoro recovery after refresh (timestamp-based)");
const tA = (await a2.post("/api/tasks", task("Calculus Homework", { type: "assignment" }))).data.task;
r = await a2.post("/api/pomodoro/start", { preset: "25/5", taskId: tA.id });
const focusId = r.data.live?.id;
check("owner A starts 25/5 linked to a task", r.status === 201 && r.data.live?.task?.id === tA.id, r.data);
r = await a2.get(`/api/tasks/${tA.id}`);
check("task automatically moved to In Progress", r.data.task.storedStatus === "in_progress", r.data.task.storedStatus);
r = await a2.post("/api/pomodoro/start", { preset: "25/5" });
check("cannot start a second timer", r.status === 409 && code(r) === "SESSION_IN_PROGRESS");
(await db.run("UPDATE pomodoro_sessions SET started_at = started_at - 600000 WHERE id = ?", focusId));
r = await a2.get("/api/pomodoro/state");
const rem = r.data.live?.remainingMs;
check("after '10 minutes' a fresh load shows ≈15:00 left", rem > 14.9 * 60_000 && rem <= 15 * 60_000, rem);
r = await a2.post(`/api/pomodoro/${focusId}`, { action: "pause" });
check("pause", r.data.live?.status === "paused");
// Simulate 2 minutes spent paused: the whole timeline (start + pause start) moves back.
(await db.run("UPDATE pomodoro_sessions SET started_at = started_at - 120000, paused_at = paused_at - 120000 WHERE id = ?", focusId));
r = await a2.post(`/api/pomodoro/${focusId}`, { action: "resume" });
check("resume — paused time not counted", r.data.live?.status === "active" && Math.abs(r.data.live.remainingMs - rem) < 3000, r.data.live?.remainingMs);
(await db.run("UPDATE pomodoro_sessions SET started_at = started_at - 960000 WHERE id = ?", focusId));
r = await a2.get("/api/pomodoro/state");
check("timer ran out while closed → focus completed, break auto-started", r.data.live?.kind === "break" && r.data.live.remainingMs > 3 * 60_000 && r.data.live.remainingMs < 5 * 60_000, r.data.live);
const breakId = r.data.live?.id;
r = await a2.post(`/api/pomodoro/${breakId}`, { action: "extend" });
check("Premium can extend a break by 5 min", r.data.live?.remainingMs > 8 * 60_000, r.data.live?.remainingMs);
r = await a2.post(`/api/pomodoro/${breakId}`, { action: "pause" });
(await db.run("UPDATE pomodoro_sessions SET paused_at = paused_at - 16 * 60000 WHERE id = ?", breakId));
r = await a2.get("/api/pomodoro/state");
check("paused > 15 min → automatically ended", r.data.live === null && r.data.last?.endReason === "pause_timeout", r.data.last);
r = await a2.get("/api/pomodoro/history");
const done = r.data.items?.find((s) => s.id === focusId);
check("completed session stored with 25 focused minutes", done?.status === "completed" && done.focusedMinutes === 25, done);
check("Premium history includes statistics", r.data.stats?.completedSessions >= 1 && r.data.limit === 20, r.data.stats);
r = await a2.get(`/api/tasks/${tA.id}`);
check("focus minutes accumulated on the task", r.data.task.focusMinutes === 25 && r.data.focusSessions?.length === 1, { m: r.data.task.focusMinutes });

// 13 ────────────────────────────────────────────────────────────────────────
group("13. Access restrictions for non-stand users (even with Premium)");
(await db.run("INSERT INTO user_subscriptions (user_id, plan_code, source, starts_at, ends_at, created_at) VALUES (?, 'monthly', 'admin', ?, ?, ?)", s1id, Date.now() - 1000, Date.now() + 30 * DAY, Date.now()));
r = await s1.get("/api/me");
check("standard user is Premium again", r.data.access?.isPremium === true && r.data.access?.subscriptionRequired === false);
check("…but stand features stay off", !r.data.access.features.pomodoro && !r.data.access.features.checkin && !r.data.access.features.moodHistory);
r = await s1.get("/api/tasks?status=all");
check("renewing restores access to the kept tasks", r.status === 200 && r.data.items.length === tasksBeforeExpiry, { n: r.data.items?.length });
for (const [m, p, b] of [["get", "/api/pomodoro/state"], ["post", "/api/pomodoro/start", { preset: "25/5" }], ["post", "/api/checkins", { mood: "good", mindset: "ready" }], ["get", "/api/checkins"], ["get", "/api/stand"], ["get", "/api/pomodoro/history"], ["get", "/api/audio"]]) {
  r = await s1[m](p, b);
  check(`${m.toUpperCase()} ${p} → 403 STAND_OWNER_ONLY`, r.status === 403 && code(r) === "STAND_OWNER_ONLY", r.data);
}
r = await s1.post("/api/nfc/verify", proofA);
check("tapping someone else's stand → WRONG_OWNER", r.status === 403 && code(r) === "WRONG_OWNER", r.data);
r = await s1.get("/api/export?kind=mood&format=csv&from=2026-01-01&to=2026-12-31");
check("mood export refused for non-stand user", r.status === 403);

// 14 ────────────────────────────────────────────────────────────────────────
group("14. Mood check-in persistence");
r = await a2.post("/api/checkins", { mood: "stressed", mindset: "pressured", intensity: 4, note: "Big exam soon", verificationId: 999999 });
check("Premium owner checks in", r.status === 201 && r.data.response?.message, r.data);
r = await a2.post("/api/checkins", { mood: "good", mindset: "ready" });
check("comparison with previous check-in (Premium)", r.data.previous?.mood === "stressed", r.data.previous);
r = await a2.get("/api/checkins");
check("history returns stored check-ins", r.status === 200 && r.data.items.length === 2 && r.data.items.some((c) => c.note === "Big exam soon"), r.data.items?.length);
check("mood distribution computed", r.data.insights.distribution.find((d) => d.mood === "good")?.count === 1);
r = await b1.post("/api/checkins", { mood: "tired", mindset: "starting" });
check("Freemium owner can check in", r.status === 201 && r.data.historyLocked === true && r.data.previous === null, r.data);
r = await b1.get("/api/checkins");
check("…but cannot view history", r.status === 403 && code(r) === "PREMIUM_REQUIRED");
r = await b1.post("/api/checkins", { mood: "sad", mindset: "ready" });
check("invalid mood rejected", r.status === 400);

// 15 ────────────────────────────────────────────────────────────────────────
group("15. Summary statistics accuracy");
await a2.post(`/api/tasks/${tA.id}/status`, { status: "completed" });
r = await a2.get("/api/summary?range=week");
const sum = r.data;
const dbFocus = (await db.get("SELECT COUNT(*) AS n, COALESCE(SUM(focused_seconds),0) AS s FROM pomodoro_sessions WHERE user_id = ? AND kind='focus' AND status='completed'", (await userId(ownerA.username))));
check("focus sessions match the database", sum.overview?.focusSessions === dbFocus.n, { api: sum.overview?.focusSessions, db: dbFocus.n });
check("focus minutes match the database", sum.overview?.focusMinutes === Math.round(dbFocus.s / 60), { api: sum.overview?.focusMinutes, db: dbFocus.s / 60 });
check("tasks completed this week = 1", sum.overview?.tasksCompleted === 1, sum.overview);
check("daily series has 7 days", sum.daily?.length === 7);
check("subject/type breakdowns present for Premium", Array.isArray(sum.subjectFocus) && sum.tier === "advanced" && sum.previous !== null);
check("insights mention the real session count", sum.insights?.some((i) => i.includes(`${dbFocus.n} focus session`)), sum.insights);
check("mood insights included for Premium stand owner", sum.mood?.total === 2, sum.mood?.total);
r = await b1.get("/api/summary?range=week");
check("Freemium summary is basic", r.data.tier === "basic" && r.data.previous === null && r.data.mood === null);
r = await a2.get("/api/dashboard");
check("dashboard: today's focus minutes", r.data.today?.focusMinutes === Math.round(dbFocus.s / 60), r.data.today);
check("dashboard: streak counts today", r.data.streak?.current >= 1, r.data.streak);
r = await a2.get("/api/achievements");
check("achievements unlocked from real activity", r.data.items.find((a) => a.key === "first_focus")?.unlockedAt && r.data.items.find((a) => a.key === "first_task")?.unlockedAt);

// 16 ────────────────────────────────────────────────────────────────────────
group("16. Data export");
// End the range a couple of days ahead so server-time-zone "today" is always included.
const today = new Date(Date.now() + 2 * DAY).toISOString().slice(0, 10);
const yearAgo = new Date(Date.now() - 365 * DAY).toISOString().slice(0, 10);
r = await a2.get(`/api/export?kind=tasks&format=csv&from=${yearAgo}&to=${today}`);
check("tasks CSV", r.status === 200 && typeof r.data === "string" && r.data.includes("Title,Type,Subject") && r.data.includes("Calculus Homework"), String(r.data).slice(0, 120));
check("…downloads as an attachment", /attachment; filename="focusdock-tasks-/.test(r.headers.get("content-disposition") ?? ""));
r = await a2.get(`/api/export?kind=pomodoro&format=csv&from=${yearAgo}&to=${today}`);
check("Pomodoro CSV", r.status === 200 && String(r.data).includes("Started,Ended") && String(r.data).includes("Calculus Homework"), String(r.data).slice(0, 120));
r = await a2.get(`/api/export?kind=mood&format=csv&from=${yearAgo}&to=${today}`);
check("mood CSV for Premium stand owner", r.status === 200 && String(r.data).includes("Stressed"));
r = await a2.get(`/api/export?kind=full&format=pdf&from=${yearAgo}&to=${today}`);
check("full report PDF", r.status === 200 && Buffer.isBuffer(r.data) && r.data.subarray(0, 5).toString() === "%PDF-" && r.data.length > 1500, r.data?.length);
for (const kind of ["full", "tasks", "stats"]) {
  r = await a2.get(`/api/export?kind=${kind}&format=json&from=${yearAgo}&to=${today}`);
  check(`JSON export removed (${kind})`, r.status === 400, r.status);
}
r = await a2.get(`/api/export?kind=tasks&format=csv&from=${yearAgo}&to=${today}`);
check("export contains only own data", !String(r.data).includes("Free task"));
r = await a2.get(`/api/export?kind=tasks&format=pdf&from=${yearAgo}&to=${today}`);
check("unsupported format combination rejected", r.status === 400);
r = await b1.get(`/api/export?kind=tasks&format=csv&from=${yearAgo}&to=${today}`);
check("Freemium export refused", r.status === 403 && code(r) === "PREMIUM_REQUIRED");
const csvTask = (await a2.post("/api/tasks", task("=HYPERLINK(\"http://x\")"))).data.task;
r = await a2.get(`/api/export?kind=tasks&format=csv&from=${yearAgo}&to=${today}`);
check("CSV formula injection neutralised", String(r.data).includes(`"'=HYPERLINK(""http://x"")"`), String(r.data).split("\n").find((l) => l.includes("HYPERLINK")));
await a2.del(`/api/tasks/${csvTask.id}`);
check("export requests are logged", (await db.get("SELECT COUNT(*) AS n FROM export_requests WHERE user_id = ?", (await userId(ownerA.username)))).n >= 5);

// 17 ────────────────────────────────────────────────────────────────────────
group("17. Unsupported laptop and tablet access");
const pageFor = async (ua) => {
  const res = await fetch(BASE + "/welcome", { headers: { "User-Agent": ua }, redirect: "manual" });
  return { status: res.status, html: await res.text() };
};
const UAS = {
  "Windows laptop (Chrome)": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36",
  "Linux desktop (Firefox)": "Mozilla/5.0 (X11; Linux x86_64; rv:128.0) Gecko/20100101 Firefox/128.0",
  "Chromebook": "Mozilla/5.0 (X11; CrOS x86_64 15917.0.0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36",
  "iPad": "Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
  "Android tablet": "Mozilla/5.0 (Linux; Android 14; SM-X710) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36",
};
for (const [name, ua] of Object.entries(UAS)) {
  const p = await pageFor(ua);
  check(`${name} → unsupported-device screen`, p.html.includes("designed exclusively for smartphones"), p.status);
}
for (const [name, ua] of Object.entries({ iPhone: IPHONE, "Android phone": ANDROID })) {
  const p = await pageFor(ua);
  check(`${name} → app served (not blocked)`, p.status === 200 && !p.html.includes("designed exclusively for smartphones") && p.html.includes("ATHENTIV FocusDock"), p.status);
}
console.log("  ℹ macOS-reporting iPads and touch/screen checks are enforced client-side (src/lib/device.ts); test those in a browser.");

// 18 ────────────────────────────────────────────────────────────────────────
group("18. User data isolation");
const victimTask = ids[2];
const victimSubject = (await s1.post("/api/subjects", { name: `Private ${tag}`, color: "#2563EB", icon: "book" })).data.created?.[0]?.id;
for (const [m, p, b] of [
  ["get", `/api/tasks/${victimTask}`],
  ["patch", `/api/tasks/${victimTask}`, { title: "hacked" }],
  ["post", `/api/tasks/${victimTask}/status`, { status: "completed" }],
  ["post", `/api/tasks/${victimTask}/checklist`, { label: "x" }],
  ["del", `/api/tasks/${victimTask}`],
  ["patch", `/api/subjects/${victimSubject}`, { name: "hacked" }],
  ["del", `/api/subjects/${victimSubject}`],
  ["get", `/api/billing/sandbox/${txn}`],
  ["post", `/api/billing/sandbox/${txn}`, { outcome: "success" }],
]) {
  r = await a2[m](p, b);
  check(`owner A cannot ${m.toUpperCase()} ${p.replace(/\d+/g, ":id")} of another user (404)`, r.status === 404, r.status);
}
r = await a2.post("/api/tasks", task("Linked to someone else's subject", { subjectId: victimSubject }));
check("cannot attach another user's subject", r.status === 400, r.data);
r = await a2.post(`/api/pomodoro/${focusId + 100000}`, { action: "pause" });
check("cannot act on a session that isn't yours", r.status === 409 || r.status === 404, r.status);
r = await a2.get("/api/tasks?status=all");
check("task list only contains own tasks", r.data.items.every((t) => !t.title.startsWith("Free task") && !t.title.startsWith("Premium task")));
r = await b1.get(`/api/tasks/${victimTask}`);
check("victim's task untouched", r.data.task?.title !== "hacked" && r.status === 200);
r = await new Phone().get("/api/tasks");
check("anonymous request → 401", r.status === 401);

// ---------------------------------------------------------------------------
db.close();
console.log(`\n${passed} passed, ${failures.length} failed`);
if (failures.length) {
  console.log("\nFailures:\n" + failures.map((f) => "  • " + f).join("\n"));
  process.exit(1);
}
