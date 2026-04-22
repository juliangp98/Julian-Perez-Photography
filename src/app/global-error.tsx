"use client";

// Root-level error boundary. Catches failures inside the root layout
// itself (where the usual `error.tsx` has no working ancestor to mount
// into). This component must emit its own <html> and <body> because
// Next replaces the entire tree when the root layout throws.
//
// The styling is intentionally minimal and inline: a stylesheet loaded
// from the failing root layout is not guaranteed to be available when
// this renders.

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[global-error]", error.digest ?? "(no digest)", error);
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily:
            "-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif",
          backgroundColor: "#fafaf7",
          color: "#0e0e0e",
        }}
      >
        <main style={{ maxWidth: "520px", padding: "40px 24px", textAlign: "center" }}>
          <div
            style={{
              fontSize: "11px",
              letterSpacing: "0.2em",
              textTransform: "uppercase",
              color: "#8a6e4b",
            }}
          >
            Unexpected error
          </div>
          <h1
            style={{
              fontFamily: "Georgia, 'Times New Roman', serif",
              fontSize: "36px",
              margin: "16px 0 0",
              lineHeight: 1.2,
            }}
          >
            The site itself hit a problem.
          </h1>
          <p style={{ color: "#6b6b6b", marginTop: "16px", lineHeight: 1.6 }}>
            A retry usually helps. If it keeps happening, please email
            juliangperez98@gmail.com directly.
          </p>
          <button
            onClick={reset}
            style={{
              marginTop: "32px",
              padding: "10px 20px",
              border: "1px solid #0e0e0e",
              borderRadius: "9999px",
              background: "transparent",
              fontSize: "14px",
              cursor: "pointer",
            }}
          >
            Try again
          </button>
        </main>
      </body>
    </html>
  );
}
