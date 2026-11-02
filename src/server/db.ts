// Database access. Uses libSQL: a hosted Turso database in production (TURSO_DATABASE_URL),
// or a local SQLite file in development (DATABASE_PATH, default ./data/focusdock.db).
import { AsyncLocalStorage } from "node:async_hooks";
import path from "node:path";
import fs from "node:fs";
import { createClient, type Client, type InValue, type Transaction } from "@libsql/client";
import { runMigrations } from "../../db/migrate.mjs";

type Param = InValue | boolean | undefined;
type Executor = Client | Transaction;

const g = globalThis as unknown as { __focusdockDb?: Client; __focusdockReady?: Promise<void> };
const txStore = new AsyncLocalStorage<Transaction>();

export function databaseUrl(): string {
  if (process.env.TURSO_DATABASE_URL) return process.env.TURSO_DATABASE_URL;
  if (process.env.VERCEL) {
    throw new Error("TURSO_DATABASE_URL is not set. Add TURSO_DATABASE_URL and TURSO_AUTH_TOKEN in Vercel → Settings → Environment Variables, then redeploy.");
  }
  const file = process.env.DATABASE_PATH || path.join(process.cwd(), "data", "focusdock.db");
  fs.mkdirSync(path.dirname(file), { recursive: true });
  return "file:" + file;
}

function client(): Client {
  g.__focusdockDb ??= createClient({ url: databaseUrl(), authToken: process.env.TURSO_AUTH_TOKEN });
  return g.__focusdockDb;
}

/** Applies pending migrations once per server instance before the first query. */
function ready(): Promise<void> {
  g.__focusdockReady ??= runMigrations(client(), path.join(process.cwd(), "db", "migrations"))
    .then(() => undefined)
    .catch((e: unknown) => {
      g.__focusdockReady = undefined;
      throw e;
    });
  return g.__focusdockReady;
}

// libSQL rejects booleans and undefined; normalise them so callers can pass plain JS values.
function norm(params: Param[]): InValue[] {
  return params.map((p) => (p === undefined ? null : typeof p === "boolean" ? (p ? 1 : 0) : p));
}

async function exec(sql: string, params: Param[]) {
  const t = txStore.getStore();
  const target: Executor = t ?? (await ready(), client());
  return target.execute({ sql, args: norm(params) });
}

export async function one<T>(sql: string, ...params: Param[]): Promise<T | undefined> {
  const r = await exec(sql, params);
  return r.rows[0] as T | undefined;
}

export async function all<T>(sql: string, ...params: Param[]): Promise<T[]> {
  const r = await exec(sql, params);
  return r.rows as unknown as T[];
}

export async function run(sql: string, ...params: Param[]): Promise<{ changes: number; id: number }> {
  const r = await exec(sql, params);
  return { changes: r.rowsAffected, id: Number(r.lastInsertRowid ?? 0) };
}

/**
 * Runs `fn` inside a write transaction. Every one/all/run call made (and awaited) inside `fn`
 * goes through the transaction automatically. Nested calls join the outer transaction.
 */
export async function tx<T>(fn: () => Promise<T>): Promise<T> {
  if (txStore.getStore()) return fn();
  await ready();
  const t = await client().transaction("write");
  try {
    const result = await txStore.run(t, fn);
    await t.commit();
    return result;
  } catch (err) {
    await t.rollback().catch(() => {});
    throw err;
  } finally {
    t.close();
  }
}

export function isUniqueViolation(err: unknown): boolean {
  return err instanceof Error && /UNIQUE constraint failed/i.test(err.message);
}
