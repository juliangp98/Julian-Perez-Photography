// Options every Sentry config shares (server, edge, browser). Client details
// never leave: request bodies, headers and cookies are dropped, and so are the
// local variables of stack frames, which would carry emails and messages.

import type { ErrorEvent } from "@sentry/nextjs";

export const DSN =
  process.env.NEXT_PUBLIC_SENTRY_DSN ||
  "https://f2af901b1c20bb748d4c8b37f7d938d6@o4511373294764032.ingest.us.sentry.io/4511373373341696";

export function scrub(event: ErrorEvent): ErrorEvent {
  if (event.request) {
    event.request = { url: event.request.url, method: event.request.method };
  }
  for (const exception of event.exception?.values ?? []) {
    for (const frame of exception.stacktrace?.frames ?? []) delete frame.vars;
  }
  return event;
}

export const sharedOptions = {
  // 10% of traces in production stays inside the free tier's quota.
  tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1,
  sendDefaultPii: false,
  beforeSend: scrub,
};
