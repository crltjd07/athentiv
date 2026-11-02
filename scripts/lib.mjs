// Helpers shared by the CLI scripts. Kept in plain JS so they run with `node` directly.
// They talk to the same database as the app: Turso when TURSO_DATABASE_URL is set (from
// .env.local or the environment), otherwise the local SQLite file.
import { createHash, randomBytes, scrypt as scryptCb } from "node:crypto";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { createClient } from "@libsql/client";
import { runMigrations } from "../db/migrate.mjs";

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

/**
 * Opens the database and applies migrations. Returns small async helpers:
 *   db.get(sql, ...args)  → first row or undefined
 *   db.all(sql, ...args)  → rows
 *   db.run(sql, ...args)  → { changes, id }
 */
export async function openDb() {
  loadEnv();
  let url = process.env.TURSO_DATABASE_URL;
  let label = url;
  if (!url) {
    const file = process.env.DATABASE_PATH ? path.resolve(root, process.env.DATABASE_PATH) : path.join(root, "data", "focusdock.db");
    fs.mkdirSync(path.dirname(file), { recursive: true });
    url = "file:" + file;
    label = file;
  }
  const client = createClient({ url, authToken: process.env.TURSO_AUTH_TOKEN });
  const ran = await runMigrations(client, path.join(root, "db", "migrations"));
  const args = (a) => a.map((v) => (v === undefined ? null : typeof v === "boolean" ? (v ? 1 : 0) : v));
  const db = {
    client,
    get: async (sql, ...a) => (await client.execute({ sql, args: args(a) })).rows[0],
    all: async (sql, ...a) => (await client.execute({ sql, args: args(a) })).rows,
    run: async (sql, ...a) => {
      const r = await client.execute({ sql, args: args(a) });
      return { changes: r.rowsAffected, id: Number(r.lastInsertRowid ?? 0) };
    },
    close: () => client.close(),
  };
  return { db, file: label, ran, remote: !!process.env.TURSO_DATABASE_URL };
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
  const t = await db.client.transaction("write");
  const exec = async (sql, ...a) => t.execute({ sql, args: a });
  try {
    const standId = Number((await exec("INSERT INTO phone_stands (stand_code, tag_secret_hash, created_at) VALUES (?, ?, ?)", code, sha256(secret), now)).lastInsertRowid);
    const userId = Number(
      (await exec(
        `INSERT INTO users (username, password_hash, account_type, recovery_code_hash, must_change_password, created_at, updated_at)
         VALUES (?, ?, 'stand_owner', ?, 1, ?, ?)`,
        username, pwHash, recoveryHash(recovery), now, now,
      )).lastInsertRowid,
    );
    await exec("INSERT INTO user_profiles (user_id, display_name, timezone, updated_at) VALUES (?, ?, ?, ?)", userId, displayName, timezone, now);
    await exec("INSERT INTO user_preferences (user_id, updated_at) VALUES (?, ?)", userId, now);
    await exec("INSERT INTO pomodoro_configurations (user_id, updated_at) VALUES (?, ?)", userId, now);
    await exec("INSERT INTO study_audio_preferences (user_id, updated_at) VALUES (?, ?)", userId, now);
    await exec("INSERT INTO stand_assignments (stand_id, user_id, assigned_at) VALUES (?, ?, ?)", standId, userId, now);
    await t.commit();
  } catch (e) {
    await t.rollback().catch(() => {});
    throw e;
  } finally {
    t.close();
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
  fs.appendFileSync(file, `# Generated ${new Date().toISOString()} for ${appUrl()} — KEEP PRIVATE\n${lines.join("\n")}\n`);
  return file;
}
