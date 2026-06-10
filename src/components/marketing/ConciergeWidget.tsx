"use client";

// Floating "Ask" launcher + popover that hosts the ConciergeChat. Rendered
// site-wide from the root layout (only when AI is configured), but suppressed
// on routes where it doesn't belong: /faq (the chat is docked there), and the
// Studio / admin / portal app chrome. The popover is a non-modal dialog —
// labelled, Escape-closable, and it restores focus to the launcher on close.

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import ConciergeChat from "./ConciergeChat";

const HIDDEN_PREFIXES = ["/faq", "/studio", "/admin", "/portal"];

export type ConciergeWidgetProps = {
  inquireHref?: string;
  faqHref?: string;
};

export default function ConciergeWidget({
  inquireHref = "/inquire",
  faqHref = "/faq",
}: ConciergeWidgetProps) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  // Move focus into the panel when it opens.
  useEffect(() => {
    if (open) closeRef.current?.focus();
  }, [open]);

  // Reset the panel when the route changes — React's "adjust state during
  // render" pattern (converges as seenPath catches up), so no effect is needed.
  const [seenPath, setSeenPath] = useState(pathname);
  if (pathname !== seenPath) {
    setSeenPath(pathname);
    if (open) setOpen(false);
  }

  const hidden = HIDDEN_PREFIXES.some(
    (p) => pathname === p || pathname?.startsWith(`${p}/`),
  );
  if (hidden) return null;

  function close() {
    setOpen(false);
    toggleRef.current?.focus();
  }

  return (
    <>
      {open && (
        <div
          role="dialog"
          aria-label="Booking assistant"
          onKeyDown={(e) => {
            if (e.key === "Escape") close();
          }}
          className="fixed z-50 bottom-[5.5rem] right-4 sm:right-6 flex flex-col w-[min(24rem,calc(100vw-2rem))] h-[32rem] max-h-[calc(100vh-9rem)] rounded-2xl border border-[var(--border)] bg-[var(--background)] shadow-2xl overflow-hidden"
        >
          <div className="flex items-center justify-between gap-3 border-b border-[var(--border)] px-4 py-3">
            <div>
              <div className="font-medium text-sm">Ask the studio</div>
              <div className="text-[11px] text-[var(--muted)]">
                Services · pricing · booking
              </div>
            </div>
            <button
              ref={closeRef}
              type="button"
              onClick={close}
              aria-label="Close chat assistant"
              className="shrink-0 h-8 w-8 inline-flex items-center justify-center rounded-full border border-[var(--border)] text-[var(--muted)] hover:text-[var(--foreground)] hover:border-[var(--foreground)] transition"
            >
              <span aria-hidden>✕</span>
            </button>
          </div>
          <div className="flex-1 min-h-0">
            <ConciergeChat
              inquireHref={inquireHref}
              faqHref={faqHref}
              variant="panel"
            />
          </div>
        </div>
      )}

      <button
        ref={toggleRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-label={open ? "Close chat assistant" : "Open chat assistant"}
        className="fixed z-50 bottom-5 right-4 sm:right-6 inline-flex items-center gap-2 rounded-full bg-[var(--foreground)] text-[var(--background)] pl-4 pr-5 py-3 shadow-lg hover:opacity-90 transition"
      >
        <svg
          aria-hidden
          viewBox="0 0 24 24"
          className="h-5 w-5"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M21 11.5a8.38 8.38 0 0 1-8.5 8.5 8.5 8.5 0 0 1-3.8-.9L3 21l1.9-5.7a8.5 8.5 0 0 1-.9-3.8A8.38 8.38 0 0 1 12.5 3 8.5 8.5 0 0 1 21 11.5z" />
        </svg>
        <span className="text-sm font-medium">Ask</span>
      </button>
    </>
  );
}
