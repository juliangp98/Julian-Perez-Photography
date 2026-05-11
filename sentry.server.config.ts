// Sentry initialization for the Node.js server runtime — covers API
// routes, server components, and route-handler error paths. Loaded by
// @sentry/nextjs at server startup via instrumentation hooks; also
// referenced through the next.config.ts `withSentryConfig` wrapper.
//
// DSN-absent path: no-op. Same envelope-stripping policy as the
// client config keeps captured events PII-free even when an API route
// calls `Sentry.captureException` with a request body in scope.

import * as Sentry from "@sentry/nextjs";

const dsn = process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    tracesSampleRate: 0.1,
    // Attach captured local variable values to stack frames so a
    // captured exception carries enough state to diagnose without a
    // reproduction (e.g. which questionnaire field tripped the
    // render). Sentry redacts values that look like secrets server-
    // side before display.
    includeLocalVariables: true,
    // Activate Sentry's Logs product so `Sentry.logger.*` calls land
    // alongside captured exceptions. Useful for narrating non-error
    // signals (e.g. webhook fired but skipped revalidation because
    // the `_type` wasn't in the filter set).
    enableLogs: true,
    enabled:
      process.env.NODE_ENV !== "development" ||
      process.env.SENTRY_DEV === "1",
    beforeSend(event) {
      // Drop request body / headers / cookies before send. Inquiry +
      // questionnaire payloads contain real client names, emails, and
      // free-form messages — none of that should land in Sentry.
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
