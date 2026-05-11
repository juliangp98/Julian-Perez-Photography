// This file configures the initialization of Sentry on the server.
// The config you add here will be used whenever the server handles a request.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: "https://f2af901b1c20bb748d4c8b37f7d938d6@o4511373294764032.ingest.us.sentry.io/4511373373341696",

  // Skip SDK activation in local dev (and e2e test runs, which use the
  // dev server). Without this, every page load in dev fires traces +
  // events at the production Sentry project, polluting the dashboard
  // and slowing the dev server enough that Turbopack cold-compiles
  // overrun Playwright's per-test timeouts. Override with
  // `SENTRY_DEV=1` when locally debugging an actual Sentry-related
  // issue.
  enabled:
    process.env.NODE_ENV !== "development" ||
    process.env.SENTRY_DEV === "1",

  // 10% trace sampling in production keeps event volume comfortably
  // inside Sentry's Developer-tier quota (10k traces / month). The
  // dev gate above means the higher dev-time sampling never fires
  // outside of explicit `SENTRY_DEV=1` debugging.
  tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1,

  // Attach captured local variable values to stack frames so a
  // captured exception carries enough state to diagnose without a
  // reproduction (e.g. which questionnaire field tripped the render).
  // Node-only — not supported on the Edge runtime.
  includeLocalVariables: true,

  // Enable logs to be sent to Sentry
  enableLogs: true,

  // PII off by default. Inquiry + questionnaire payloads carry real
  // client names, emails, phone numbers, and free-form messages — the
  // honeypot + rate-limit + HMAC chain everywhere else assumes that
  // data stays inside this project's own infrastructure. The
  // `beforeSend` strip below is a defense-in-depth backup in case
  // Sentry's auto-attached request data still includes anything from
  // headers / cookies.
  sendDefaultPii: false,
  beforeSend(event) {
    // Drop request body / headers / cookies before send. Keep just
    // the URL + method so events still group cleanly by route.
    if (event.request) {
      event.request = {
        url: event.request.url,
        method: event.request.method,
      };
    }
    return event;
  },
});
