// Sentry for the Edge runtime (loaded by instrumentation.ts).
import * as Sentry from "@sentry/nextjs";
import { DSN, sharedOptions } from "./sentry.shared";

Sentry.init({
  ...sharedOptions,
  dsn: DSN,
  enabled: process.env.NODE_ENV !== "development" || process.env.SENTRY_DEV === "1",
  enableLogs: true,
});
