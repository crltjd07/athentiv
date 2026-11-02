import { DatabaseSync, type SQLInputValue, type StatementSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";
import { runMigrations } from "../../db/migrate.mjs";

type Param = SQLInputValue | boolean | undefined;

const g = globalThis as unknown as {
  __focusdockDb?: DatabaseSync;
  __focusdockStmts?: Map<string, StatementSync>;
};

export function databasePath(): string {
  return process.env.DATABASE_PATH || path.join(process.cwd(), "data", "focusdock.db");
}

/** Lazily opens the database and applies pending migrations once per process. */
export function db(): DatabaseSync {
  if (!g.__focusdockDb) {
    const file = databasePath();
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const conn = new DatabaseSync(file);
    conn.exec("PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;");
    runMigrations(conn, path.join(process.cwd(), "db", "migrations"));
    g.__focusdockDb = conn;
    g.__focusdockStmts = new Map();
  }
  return g.__focusdockDb;
}

function stmt(sql: string): StatementSync {
  const conn = db();
  const cache = g.__focusdockStmts!;
  let s = cache.get(sql);
  if (!s) {
    s = conn.prepare(sql);
    cache.set(sql, s);
  }
  return s;
}

// node:sqlite rejects booleans and undefined; normalise them so callers can pass plain JS values.
function norm(params: Param[]): SQLInputValue[] {
  return params.map((p) => (p === undefined ? null : typeof p === "boolean" ? (p ? 1 : 0) : p));
}

export function one<T>(sql: string, ...params: Param[]): T | undefined {
  return stmt(sql).get(...norm(params)) as T | undefined;
}

export function all<T>(sql: string, ...params: Param[]): T[] {
  return stmt(sql).all(...norm(params)) as T[];
}

export function run(sql: string, ...params: Param[]): { changes: number; id: number } {
  const r = stmt(sql).run(...norm(params));
  return { changes: Number(r.changes), id: Number(r.lastInsertRowid) };
}

let depth = 0;

/** Runs `fn` inside a write transaction. Nested calls join the outer transaction. */
export function tx<T>(fn: () => T): T {
  const conn = db();
  if (depth > 0) return fn();
  conn.exec("BEGIN IMMEDIATE");
  depth++;
  try {
    const result = fn();
    conn.exec("COMMIT");
    return result;
  } catch (err) {
    conn.exec("ROLLBACK");
    throw err;
  } finally {
    depth--;
  }
}

export function isUniqueViolation(err: unknown): boolean {
  return err instanceof Error && /UNIQUE constraint failed/i.test(err.message);
}
