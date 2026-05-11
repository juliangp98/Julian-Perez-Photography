// Sentry initialization for the browser bundle. Next.js auto-loads
// `instrumentation-client.ts` for client-side init — this is the
// modern equivalent of the legacy `sentry.client.config.ts` that
// the wizard used to generate.
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
// honeypot + rate-limit + HMAC chain everywhere else. Replay's
// `maskAllText`/`maskAllInputs`/`blockAllMedia` defaults extend the
// same stance to recorded sessions.

import * as Sentry from "@sentry/nextjs";

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    // Higher sampling in dev makes traces easy to spot-check; 10% in
    // production balances visibility against quota.
    tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,
    // Replay: 10% ambient session capture, 100% capture on any session
    // that hits an error so the failure is reproducible end-to-end.
    // Replay's defaults already mask text + inputs in v10+; the
    // explicit flags below pin that behavior so a future SDK upgrade
    // can't silently widen what gets recorded.
    replaysSessionSampleRate: 0.1,
    replaysOnErrorSampleRate: 1.0,
    integrations: [
      Sentry.replayIntegration({
        maskAllText: true,
        maskAllInputs: true,
        blockAllMedia: true,
      }),
    ],
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

// App Router navigation tracing hook (@sentry/nextjs >= 9). Fires on
// every client-side route transition so performance traces include
// full page-to-page spans, not just the initial document load. Next's
// instrumentation discovery picks this up by export name; no further
// wiring needed.
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
