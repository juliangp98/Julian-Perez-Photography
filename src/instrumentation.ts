// Runs once per server start. Loads the Sentry config for the runtime, and on
// a production Node server logs any setting production needs but doesn't have
// (src/lib/config.ts). onRequestError sends unhandled server errors to Sentry.
import * as Sentry from "@sentry/nextjs";

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("../sentry.server.config");
    if (process.env.NODE_ENV === "production") {
      const { missingInProduction } = await import("./lib/config");
      for (const s of missingInProduction()) {
        console.warn(`[config] ${s.name} is not set. ${s.without}`);
      }
    }
  }
  if (process.env.NEXT_RUNTIME === "edge") {
    await import("../sentry.edge.config");
  }
}

export const onRequestError = Sentry.captureRequestError;
