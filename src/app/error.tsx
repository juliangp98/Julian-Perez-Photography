"use client";

// Route-segment error boundary for pages and layouts below the root layout;
// `reset()` retries the segment render. Root layout failures are handled by
// global-error.tsx.

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";
import Button from "@/components/ui/Button";

export default function RouteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // `digest` correlates the client error with the server log entry.
    console.error("[route-error]", error.digest ?? "(no digest)", error);
    Sentry.captureException(error, {
      tags: { boundary: "route", digest: error.digest ?? "unknown" },
    });
  }, [error]);

  return (
    <section className="max-w-3xl mx-auto px-6 lg:px-10 py-24 text-center">
      <div className="text-xs uppercase tracking-[0.2em] text-accent">
        Something went wrong
      </div>
      <h1 className="mt-4 font-serif text-4xl">
        This page hit an unexpected error.
      </h1>
      <p className="mt-4 text-muted">
        A retry will often resolve it. If the problem persists, the inquiry
        form is the fastest way to reach me directly. I&apos;ll help sort
        out whatever you were trying to do.
      </p>
      <div className="mt-10 flex flex-wrap justify-center gap-3">
        <Button variant="secondary" onClick={reset}>
          Try again
        </Button>
        <Button href="/inquire">Send me a note instead</Button>
      </div>
    </section>
  );
}
