import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

/** An error that is safe to show to the client. */
export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public extra?: Record<string, unknown>,
  ) {
    super(message);
  }
}

export const err = {
  badRequest: (message: string, extra?: Record<string, unknown>) => new ApiError(400, "BAD_REQUEST", message, extra),
  unauthenticated: (code = "UNAUTHENTICATED", message = "Please sign in to continue.") => new ApiError(401, code, message),
  forbidden: (code: string, message: string, extra?: Record<string, unknown>) => new ApiError(403, code, message, extra),
  notFound: (message = "Not found.") => new ApiError(404, "NOT_FOUND", message),
  conflict: (code: string, message: string, extra?: Record<string, unknown>) => new ApiError(409, code, message, extra),
  tooMany: (message = "Too many attempts. Please wait a moment and try again.", retryAfterSec?: number) =>
    new ApiError(429, "RATE_LIMITED", message, retryAfterSec ? { retryAfter: retryAfterSec } : undefined),
};

export function ok<T>(data: T, init?: ResponseInit) {
  return NextResponse.json(data, {
    ...init,
    headers: { "Cache-Control": "no-store", ...(init?.headers ?? {}) },
  });
}

const MUTATING = new Set(["POST", "PUT", "PATCH", "DELETE"]);

/**
 * CSRF defence for cookie-authenticated requests: mutating calls must come from our own origin
 * and carry a JSON body (which a plain cross-site HTML form cannot send).
 */
function assertSameOrigin(req: NextRequest) {
  if (!MUTATING.has(req.method)) return;
  if (req.headers.get("sec-fetch-site") === "cross-site") throw err.forbidden("CSRF", "Cross-site request blocked.");
  const origin = req.headers.get("origin");
  if (origin) {
    const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
    let originHost = "";
    try {
      originHost = new URL(origin).host;
    } catch {
      /* fallthrough */
    }
    if (!host || originHost !== host) throw err.forbidden("CSRF", "Cross-origin request blocked.");
  }
  const len = req.headers.get("content-length");
  const hasBody = (len !== null && len !== "0") || req.headers.has("transfer-encoding");
  if (hasBody && !req.headers.get("content-type")?.includes("application/json")) {
    throw new ApiError(415, "UNSUPPORTED_MEDIA_TYPE", "Requests must be sent as JSON.");
  }
}

type Handler<C> = (req: NextRequest, ctx: C) => Promise<Response> | Response;

/** Wraps a route handler with CSRF checks and uniform JSON error responses. */
export function route<C = unknown>(fn: Handler<C>): Handler<C> {
  return async (req, ctx) => {
    try {
      assertSameOrigin(req);
      return await fn(req, ctx);
    } catch (e) {
      if (e instanceof ApiError) {
        const headers: Record<string, string> = { "Cache-Control": "no-store" };
        if (e.status === 429 && e.extra?.retryAfter) headers["Retry-After"] = String(e.extra.retryAfter);
        return NextResponse.json({ error: { code: e.code, message: e.message, ...e.extra } }, { status: e.status, headers });
      }
      if (e instanceof z.ZodError) {
        const first = e.issues[0];
        const field = first?.path.join(".");
        return NextResponse.json(
          {
            error: {
              code: "VALIDATION",
              message: first ? `${field ? field + ": " : ""}${first.message}` : "Invalid input.",
              fields: Object.fromEntries(e.issues.map((i) => [i.path.join("."), i.message])),
            },
          },
          { status: 400 },
        );
      }
      console.error("[api]", req.method, req.nextUrl.pathname, e);
      return NextResponse.json(
        { error: { code: "INTERNAL", message: "Something went wrong on our side. Please try again." } },
        { status: 500 },
      );
    }
  };
}

export async function readJson<T>(req: NextRequest, schema: z.ZodType<T>): Promise<T> {
  let raw: unknown;
  try {
    const text = await req.text();
    if (text.length > 64_000) throw err.badRequest("Request body is too large.");
    raw = text ? JSON.parse(text) : {};
  } catch (e) {
    if (e instanceof ApiError) throw e;
    throw err.badRequest("Request body must be valid JSON.");
  }
  return schema.parse(raw);
}

export function readQuery<T>(req: NextRequest, schema: z.ZodType<T>): T {
  return schema.parse(Object.fromEntries(req.nextUrl.searchParams.entries()));
}

export function idParam(value: string): number {
  const id = Number(value);
  if (!Number.isSafeInteger(id) || id <= 0) throw err.notFound();
  return id;
}

export function clientIp(req: NextRequest): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "local";
}

// ---------------------------------------------------------------------------
// Rate limiting (fixed window, in memory). Suitable for a single server instance;
// see docs/DEPLOYMENT.md for multi-instance deployments.
// ---------------------------------------------------------------------------

const buckets = new Map<string, { count: number; resetAt: number }>();

export function rateLimit(key: string, limit: number, windowMs: number) {
  // Test-only escape hatch so the API suite can be re-run from one IP. Never set in production.
  if (process.env.RATE_LIMITS === "off" && process.env.NODE_ENV !== "production") return;
  const now = Date.now();
  const b = buckets.get(key);
  if (!b || b.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    if (buckets.size > 10_000) {
      for (const [k, v] of buckets) if (v.resetAt <= now) buckets.delete(k);
    }
    return;
  }
  b.count++;
  if (b.count > limit) throw err.tooMany(undefined, Math.ceil((b.resetAt - now) / 1000));
}
