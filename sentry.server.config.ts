// Sentry for the Node server (loaded by instrumentation.ts).
import * as Sentry from "@sentry/nextjs";
import { DSN, sharedOptions } from "./sentry.shared";

Sentry.init({
  ...sharedOptions,
  dsn: DSN,
  // Off in local dev and e2e runs (SENTRY_DEV=1 to debug Sentry itself).
  enabled: process.env.NODE_ENV !== "development" || process.env.SENTRY_DEV === "1",
  enableLogs: true,
});
