// One shape for the site's JSON API routes. defineRoute() does the parts every
// route needs, in the same order everywhere: auth, rate limit, JSON + schema
// parsing, the honeypot, and reporting an unexpected failure to Sentry with
// the route's tag. A handler only does its own job and returns its body (or a
// Response when it needs a specific status).
//
// Every error response is `{ error: string }`, so clients read them one way.

import { NextResponse } from "next/server";
import type { z } from "zod";
import * as Sentry from "@sentry/nextjs";
import { getAdminSession, getSession } from "@/lib/auth-cookies";
import type { AdminClaims, SessionClaims } from "@/lib/auth";
import { isHoneypotTriggered, rateLimitResponse } from "@/lib/request-guard";

type Auth = "admin" | "portal" | "public";
type SessionFor<A extends Auth> = A extends "admin"
  ? AdminClaims
  : A extends "portal"
    ? SessionClaims
    : null;

export type RouteContext<A extends Auth> = { req: Request; session: SessionFor<A> };

export function apiError(status: number, error: string): NextResponse {
  return NextResponse.json({ error }, { status });
}

export function defineRoute<S extends z.ZodType, A extends Auth>(opts: {
  // Sentry tag and rate-limit bucket, e.g. "admin/ai".
  route: string;
  auth: A;
  schema: S;
  rateLimit?: { max: number; windowMs: number };
  // When true, a filled `hp_company` field gets a silent `{ ok: true }`.
  honeypot?: boolean;
  // The 400 message for a body that fails the schema.
  invalid?: string;
  // What an unexpected error answers (default 500, "Something went wrong.").
  failure?: { status: number; error: string };
  // Extra Sentry tags computed at failure time from the request (e.g. the
  // model in use, or which kind of request it was).
  tags?: (data: z.infer<S>) => Record<string, string>;
  run: (
    data: z.infer<S>,
    ctx: RouteContext<A>,
  ) => Promise<Response | Record<string, unknown>>;
}): (req: Request) => Promise<Response> {
  return async (req: Request) => {
    const session =
      opts.auth === "admin"
        ? await getAdminSession()
        : opts.auth === "portal"
          ? await getSession()
          : null;
    if (opts.auth !== "public" && !session) {
      return apiError(401, opts.auth === "admin" ? "Not authorized." : "Not signed in.");
    }

    if (opts.rateLimit) {
      const limited = rateLimitResponse(req, { key: opts.route, ...opts.rateLimit });
      if (limited) return limited;
    }

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return apiError(400, "Invalid JSON");
    }
    const parsed = opts.schema.safeParse(body);
    if (!parsed.success) return apiError(400, opts.invalid ?? "Invalid request.");
    if (opts.honeypot && isHoneypotTriggered((parsed.data as { hp_company?: unknown }).hp_company)) {
      return NextResponse.json({ ok: true });
    }

    try {
      const out = await opts.run(parsed.data, { req, session: session as SessionFor<A> });
      return out instanceof Response ? out : NextResponse.json(out);
    } catch (err) {
      Sentry.captureException(err, {
        tags: { route: opts.route, stage: "run", ...opts.tags?.(parsed.data) },
      });
      const failure = opts.failure ?? { status: 500, error: "Something went wrong. Try again." };
      return apiError(failure.status, failure.error);
    }
  };
}

// The site's origin for links in emails and redirects: the address this request
// actually reached (on Vercel, only the project's own domains). Never the Origin
// header, which any client can set: a forged one would put another site's
// address, with a live sign-in token, into a real email from this one.
export function originOf(req: Request): string {
  return new URL(req.url).origin;
}
