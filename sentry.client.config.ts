// Sentry initialization for the browser bundle. Loaded automatically by
// @sentry/nextjs when a page or component imports a Sentry API in the
// client runtime, and via the build-time wrapper applied in
// next.config.ts.
//
// DSN-absent path: no-op. Local dev without `NEXT_PUBLIC_SENTRY_DSN`
// set keeps the SDK quiet — no network calls, no console noise. Same
// behavior on preview deployments where the env var is intentionally
// scoped to production only.
//
// Privacy: request URLs are kept (necessary for grouping events by
// route), but the rest of `event.request` is dropped before send. The
// site captures real client PII via inquiry / questionnaire forms;
// sending any of that to Sentry would defeat the purpose of the
// honeypot + rate-limit + HMAC chain everywhere else.

import * as Sentry from "@sentry/nextjs";

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    // Light sampling — the site is small and predictable, so 10% of
    // performance traces is plenty for spotting regressions without
    // burning quota. Errors are always captured (sampleRate defaults
    // to 1.0).
    tracesSampleRate: 0.1,
    // Disable the SDK in development by default — the dev server
    // throws transient errors during HMR that aren't worth shipping
    // to Sentry. Override by setting `NEXT_PUBLIC_SENTRY_DEV=1` if a
    // specific dev-time issue needs capture.
    enabled:
      process.env.NODE_ENV !== "development" ||
      process.env.NEXT_PUBLIC_SENTRY_DEV === "1",
    beforeSend(event) {
      // Strip PII-bearing request fields before send. Keep just the
      // URL + method so events still group by route.
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
