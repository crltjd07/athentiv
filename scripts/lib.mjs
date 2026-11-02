// Helpers shared by the CLI scripts. Kept in plain JS so they run with `node` directly.
import { createHash, randomBytes, scrypt as scryptCb } from "node:crypto";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { openDatabase, runMigrations } from "../db/migrate.mjs";

export const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/** Loads KEY=VALUE pairs from .env.local / .env without overriding the real environment. */
export function loadEnv() {
  for (const name of [".env.local", ".env"]) {
    const file = path.join(root, name);
    if (!fs.existsSync(file)) continue;
    for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  }
}

export async function openDb() {
  loadEnv();
  const file = process.env.DATABASE_PATH || path.join(root, "data", "focusdock.db");
  const db = await openDatabase(file);
  const ran = runMigrations(db, path.join(root, "db", "migrations"));
  return { db, file, ran };
}

// Must match src/server/crypto.ts
export function hashPassword(password) {
  const N = 2 ** 15, r = 8, p = 1;
  const salt = randomBytes(16);
  return new Promise((resolve, reject) =>
    scryptCb(password, salt, 64, { N, r, p, maxmem: 64 * 1024 * 1024 }, (err, key) =>
      err ? reject(err) : resolve(`scrypt$${N}$${r}$${p}$${salt.toString("base64")}$${key.toString("base64")}`),
    ),
  );
}

export const sha256 = (s) => createHash("sha256").update(s).digest("hex");
export const recoveryHash = (code) => sha256("recovery:" + code.toUpperCase().replace(/[^A-Z0-9]/g, ""));

export function recoveryCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = randomBytes(16);
  let out = "";
  for (let i = 0; i < 16; i++) {
    out += alphabet[bytes[i] % alphabet.length];
    if (i % 4 === 3 && i < 15) out += "-";
  }
  return out;
}

export function tagSecret() {
  return randomBytes(18).toString("base64url");
}

export function appUrl() {
  return (process.env.APP_URL || "http://localhost:3000").replace(/\/$/, "");
}

/** Creates a stand + premade owner account. Returns the credentials and the NFC tag URL. */
export async function provisionStand(db, { code, username, password, displayName, timezone = "Asia/Manila" }) {
  const now = Date.now();
  const secret = tagSecret();
  const recovery = recoveryCode();
  const pwHash = await hashPassword(password);
  db.exec("BEGIN IMMEDIATE");
  try {
    const standId = Number(
      db.prepare("INSERT INTO phone_stands (stand_code, tag_secret_hash, created_at) VALUES (?, ?, ?)").run(code, sha256(secret), now).lastInsertRowid,
    );
    const userId = Number(
      db
        .prepare(
          `INSERT INTO users (username, password_hash, account_type, recovery_code_hash, must_change_password, created_at, updated_at)
           VALUES (?, ?, 'stand_owner', ?, 1, ?, ?)`,
        )
        .run(username, pwHash, recoveryHash(recovery), now, now).lastInsertRowid,
    );
    db.prepare("INSERT INTO user_profiles (user_id, display_name, timezone, updated_at) VALUES (?, ?, ?, ?)").run(userId, displayName, timezone, now);
    db.prepare("INSERT INTO user_preferences (user_id, updated_at) VALUES (?, ?)").run(userId, now);
    db.prepare("INSERT INTO pomodoro_configurations (user_id, updated_at) VALUES (?, ?)").run(userId, now);
    db.prepare("INSERT INTO study_audio_preferences (user_id, updated_at) VALUES (?, ?)").run(userId, now);
    db.prepare("INSERT INTO stand_assignments (stand_id, user_id, assigned_at) VALUES (?, ?, ?)").run(standId, userId, now);
    db.exec("COMMIT");
  } catch (e) {
    db.exec("ROLLBACK");
    throw e;
  }
  return { code, username, password, recovery, secret, url: `${appUrl()}/nfc/${code}#k=${secret}` };
}

export function writeTagSheet(rows) {
  const file = path.join(root, "data", "stand-tags.txt");
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const lines = rows.map(
    (r) =>
      `Stand ${r.code}\n  Owner username : ${r.username}\n  Temp password  : ${r.password}  (must be changed on first sign-in)\n  Recovery code  : ${r.recovery}\n  NFC tag URL    : ${r.url}\n`,
  );
  fs.appendFileSync(file, `# Generated ${new Date().toISOString()} — KEEP PRIVATE\n${lines.join("\n")}\n`);
  return file;
}
