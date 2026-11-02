// Shared migration runner, used both by the app at startup and by `pnpm db:migrate`.
import fs from "node:fs";
import path from "node:path";

/**
 * Applies every not-yet-applied `NNN_name.sql` file in `dir`, in order, each inside
 * its own transaction. Returns the versions applied by this call.
 * @param {import("node:sqlite").DatabaseSync} db
 * @param {string} dir
 * @returns {string[]}
 */
export function runMigrations(db, dir) {
  db.exec(
    "CREATE TABLE IF NOT EXISTS schema_migrations (version TEXT PRIMARY KEY, applied_at INTEGER NOT NULL)",
  );
  const applied = new Set(
    db.prepare("SELECT version FROM schema_migrations").all().map((r) => String(r.version)),
  );
  const files = fs
    .readdirSync(dir)
    .filter((f) => /^\d+_.+\.sql$/.test(f))
    .sort();

  const ran = [];
  for (const file of files) {
    const version = file.replace(/\.sql$/, "");
    if (applied.has(version)) continue;
    const sql = fs.readFileSync(path.join(dir, file), "utf8");
    db.exec("BEGIN IMMEDIATE");
    try {
      db.exec(sql);
      db.prepare("INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)").run(version, Date.now());
      db.exec("COMMIT");
      ran.push(version);
    } catch (err) {
      db.exec("ROLLBACK");
      throw new Error(`Migration ${file} failed: ${err instanceof Error ? err.message : err}`);
    }
  }
  return ran;
}

/**
 * Opens the database with the pragmas the app relies on.
 * @param {string} file
 */
export async function openDatabase(file) {
  const { DatabaseSync } = await import("node:sqlite");
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const db = new DatabaseSync(file);
  db.exec("PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;");
  return db;
}
