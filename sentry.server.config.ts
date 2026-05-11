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

  // Define how likely traces are sampled. Adjust this value in production, or use tracesSampler for greater control.
  tracesSampleRate: 1,

  // Enable logs to be sent to Sentry
  enableLogs: true,

  // Enable sending user PII (Personally Identifiable Information)
  // https://docs.sentry.io/platforms/javascript/guides/nextjs/configuration/options/#sendDefaultPii
  sendDefaultPii: true,
});
