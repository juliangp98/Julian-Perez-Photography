// Sentry initialization for the Vercel Edge runtime — covers
// middleware, edge route handlers, and any code running on the
// Cloudflare Workers-style runtime. The Edge runtime has a narrower
// API surface than Node, so the SDK config is intentionally minimal.
//
// DSN-absent path: no-op. Same PII-stripping policy as client + server
// configs.

import * as Sentry from "@sentry/nextjs";

const dsn = process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    tracesSampleRate: 0.1,
    enabled:
      process.env.NODE_ENV !== "development" ||
      process.env.SENTRY_DEV === "1",
    beforeSend(event) {
      if (event.request) {
        event.request = {
          url: event.request.url,
          method: event.request.method,
        };
      }
      return event;
    },
  });
}
