// Shared request-guard utilities for public POST routes.
//
// Two concerns live here because both are request-gate checks that run
// near the top of every route handler:
//
//   1. Honeypot — a hidden `hp_company` field on every public form. Bots
//      fill it; humans don't. Public routes silently succeed when it's
//      populated so the bot thinks the submission worked and moves on.
//   2. Rate limit — a per-IP token bucket, keyed by endpoint so a chatty
//      uploader doesn't starve the inquiry form. In-memory only (not
//      distributed); good enough for the current scale. Swap to
//      `@upstash/ratelimit` once this outgrows a single instance — keep
//      the same signature.
//
// IP extraction uses `x-forwarded-for`, which Vercel sets to the real
// client IP as the first entry. If it's missing (local dev, unusual
// hosting), the limiter falls back to a synthetic "unknown" bucket so
// abusive traffic is still capped in aggregate.

import { NextResponse } from "next/server";

// ---------------------------------------------------------------------------
// Honeypot
// ---------------------------------------------------------------------------

/**
 * Returns true when the honeypot field is set — caller should silently
 * respond with `{ ok: true }` so bots don't learn the field is a trap.
 */
export function isHoneypotTriggered(value: unknown): boolean {
  return typeof value === "string" && value.length > 0;
}

// ---------------------------------------------------------------------------
// Rate limit — in-memory token bucket, per (key, ip)
// ---------------------------------------------------------------------------

type Bucket = { count: number; resetAt: number };

// Module-level so it survives between requests on a warm instance. On a
// cold start the buckets reset, which is fine — a fresh instance means a
// fresh window. Different endpoints get different Maps via the `key` arg.
const buckets = new Map<string, Bucket>();

// Periodic cleanup to keep the map from leaking memory on a long-lived
// instance. Runs lazily on access — no setInterval, which would keep
// the process alive on the edge runtime.
let lastSweep = 0;
function sweepExpired(now: number) {
  if (now - lastSweep < 60_000) return; // sweep at most once a minute
  lastSweep = now;
  for (const [k, v] of buckets) {
    if (v.resetAt <= now) buckets.delete(k);
  }
}

export function getClientIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) {
    // First entry is the real client per Vercel convention.
    const first = xff.split(",")[0]?.trim();
    if (first) return first;
  }
  const real = req.headers.get("x-real-ip");
  if (real) return real.trim();
  return "unknown";
}

export type RateLimitResult =
  | { ok: true }
  | { ok: false; retryAfterSeconds: number };

/**
 * Checks whether the caller is within the rate limit for this endpoint.
 * Increments the counter as a side-effect when allowed.
 *
 * @param req  The incoming request (used to derive the client IP).
 * @param opts `key` uniquely identifies the endpoint (so each gets its
 *             own bucket). `max` is the number of requests allowed per
 *             `windowMs` milliseconds.
 */
export function checkRateLimit(
  req: Request,
  opts: { key: string; max: number; windowMs: number },
): RateLimitResult {
  const now = Date.now();
  sweepExpired(now);

  const ip = getClientIp(req);
  const bucketKey = `${opts.key}:${ip}`;
  const existing = buckets.get(bucketKey);

  if (!existing || existing.resetAt <= now) {
    buckets.set(bucketKey, { count: 1, resetAt: now + opts.windowMs });
    return { ok: true };
  }

  if (existing.count >= opts.max) {
    return {
      ok: false,
      retryAfterSeconds: Math.max(1, Math.ceil((existing.resetAt - now) / 1000)),
    };
  }

  existing.count += 1;
  return { ok: true };
}

/**
 * Convenience wrapper — returns a 429 NextResponse with `Retry-After`
 * set, or null when the request is within limits. Caller should early-
 * return when non-null.
 */
export function rateLimitResponse(
  req: Request,
  opts: { key: string; max: number; windowMs: number },
): NextResponse | null {
  const result = checkRateLimit(req, opts);
  if (result.ok) return null;
  return NextResponse.json(
    {
      error:
        "Too many requests — please wait a moment and try again.",
    },
    {
      status: 429,
      headers: { "Retry-After": String(result.retryAfterSeconds) },
    },
  );
}
