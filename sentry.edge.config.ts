// This file configures the initialization of Sentry for edge features (middleware, edge routes, and so on).
// The config you add here will be used whenever one of the edge features is loaded.
// Note that this config is unrelated to the Vercel Edge Runtime and is also required when running locally.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: "https://f2af901b1c20bb748d4c8b37f7d938d6@o4511373294764032.ingest.us.sentry.io/4511373373341696",

  // Same dev-gate as the Node server config — see sentry.server.config.ts
  // for the rationale. Keeps dev / e2e runs from polluting the prod
  // Sentry project and tanking dev compile times.
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
