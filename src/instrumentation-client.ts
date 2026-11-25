// Sentry in the browser. Off in local dev (NEXT_PUBLIC_SENTRY_DEV=1 to debug
// it). Session replays mask all text and inputs and block media, and events
// carry no client details (see sentry.shared.ts).
import * as Sentry from "@sentry/nextjs";
import { DSN, sharedOptions } from "../sentry.shared";

Sentry.init({
  ...sharedOptions,
  dsn: DSN,
  enabled: process.env.NODE_ENV !== "development" || process.env.NEXT_PUBLIC_SENTRY_DEV === "1",
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,
  integrations: [
    Sentry.replayIntegration({ maskAllText: true, maskAllInputs: true, blockAllMedia: true }),
  ],
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
