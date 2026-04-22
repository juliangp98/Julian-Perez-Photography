"use client";

// Route-segment error boundary. Next renders this component whenever an
// uncaught exception bubbles up from a page or layout below the root
// layout. The `reset()` function retries the segment's render so a
// transient failure (e.g. a Sanity request that timed out) can recover
// without a full page reload.
//
// Errors in the root layout itself are caught by `global-error.tsx`
// instead — that file must render its own <html> and <body> shells.

import Link from "next/link";
import { useEffect } from "react";

export default function RouteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // `digest` is an opaque hash Next attaches so the client-side error
    // can be correlated with the server log entry. Logging it here keeps
    // a breadcrumb in the browser console until a structured reporter
    // (Sentry, Axiom, etc.) is wired up.
    console.error("[route-error]", error.digest ?? "(no digest)", error);
  }, [error]);

  return (
    <section className="max-w-3xl mx-auto px-6 lg:px-10 py-24 text-center">
      <div className="text-xs uppercase tracking-[0.2em] text-[var(--accent)]">
        Something went wrong
      </div>
      <h1 className="mt-4 font-serif text-4xl">
        This page hit an unexpected error.
      </h1>
      <p className="mt-4 text-[var(--muted)]">
        A retry will often resolve it. If the problem persists, the inquiry
        form is the fastest way to reach me directly — I&apos;ll help sort
        out whatever you were trying to do.
      </p>
      <div className="mt-10 flex flex-wrap justify-center gap-3">
        <button
          onClick={reset}
          className="px-5 py-2 border border-[var(--foreground)] rounded-full hover:bg-[var(--foreground)] hover:text-[var(--background)] transition text-sm"
        >
          Try again
        </button>
        <Link
          href="/inquire"
          className="px-5 py-2 rounded-full bg-[var(--accent)] text-white hover:opacity-90 transition text-sm"
        >
          Send me a note instead
        </Link>
      </div>
    </section>
  );
}
