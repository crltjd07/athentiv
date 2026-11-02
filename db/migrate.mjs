// Shared migration runner, used both by the app at startup and by `pnpm db:migrate`.
// Works with a local SQLite file or a hosted Turso database (both through @libsql/client).
import fs from "node:fs";
import path from "node:path";

/**
 * Applies every not-yet-applied `NNN_name.sql` file in `dir`, in order, each inside its own
 * transaction. Returns the versions applied by this call.
 * @param {import("@libsql/client").Client} db
 * @param {string} dir
 * @returns {Promise<string[]>}
 */
export async function runMigrations(db, dir) {
  await db.execute("CREATE TABLE IF NOT EXISTS schema_migrations (version TEXT PRIMARY KEY, applied_at INTEGER NOT NULL)");
  const applied = new Set((await db.execute("SELECT version FROM schema_migrations")).rows.map((r) => String(r.version)));
  const files = fs
    .readdirSync(dir)
    .filter((f) => /^\d+_.+\.sql$/.test(f))
    .sort();

  const ran = [];
  for (const file of files) {
    const version = file.replace(/\.sql$/, "");
    if (applied.has(version)) continue;
    const sql = fs.readFileSync(path.join(dir, file), "utf8");
    const tx = await db.transaction("write");
    try {
      // Split on statement boundaries (the migration files contain no semicolons inside strings).
      for (const stmt of sql.split(/;\s*(?:\r?\n|$)/).map((s) => s.replace(/^\s*--.*$/gm, "").trim()).filter(Boolean)) {
        await tx.execute(stmt);
      }
      await tx.execute({ sql: "INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)", args: [version, Date.now()] });
      await tx.commit();
      ran.push(version);
    } catch (err) {
      await tx.rollback().catch(() => {});
      // Another instance may have applied it concurrently.
      const done = (await db.execute({ sql: "SELECT 1 FROM schema_migrations WHERE version = ?", args: [version] })).rows.length;
      if (done) continue;
      throw new Error(`Migration ${file} failed: ${err instanceof Error ? err.message : err}`);
    } finally {
      tx.close();
    }
  }
  return ran;
}
