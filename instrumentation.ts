// Next.js's central instrumentation hook. Next calls `register()` once
// per server start (per runtime — Node, Edge, or both), and this file
// dispatches to the appropriate Sentry config based on which runtime
// is loading. Without this file, the server-side Sentry SDK never
// initializes, and `Sentry.captureException` calls inside API routes
// silently no-op even when a DSN is set.
//
// The `onRequestError` export (added in @sentry/nextjs >= 8.28) hooks
// Next's error reporting pipeline so unhandled errors inside React
// Server Components / route handlers / server actions flow to Sentry
// in addition to anything caught explicitly by per-route catch
// blocks. Together with the client-side App Router transition hook
// (in `instrumentation-client.ts`), this captures the full surface
// of server + client errors without per-route boilerplate.

import * as Sentry from "@sentry/nextjs";

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config");
  }
  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config");
  }
}

export const onRequestError = Sentry.captureRequestError;
