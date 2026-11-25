"use client";

import Link from "next/link";
import type { ReactNode } from "react";

// A link that opens the project page's Compose panel, on the Messages tab, on
// a template. The assessment, the next step and a project's links all hand a
// client email to Compose this way. `href` is a "?compose=<template id>…
// #compose" address on the project page. A same-page change like this leaves
// the scroll where it is, so the navigation brings the panel into view; when
// it comes from another tab, the panel scrolls itself into view as it opens
// (a click that opens a new tab leaves this page alone). A link that names no
// template, clicked while the panel is open, only brings it into view. What's
// typed and not sent is kept (compose-draft.ts), so a hand-off to another
// template doesn't lose it: going back shows it again.
export default function ComposeLink({
  href,
  className,
  children,
}: {
  href: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      scroll={false}
      onClick={(e) => {
        // Already open, and the link names no template: bring it into view
        // rather than open it afresh on nothing.
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
        const panel = document.getElementById("compose");
        if (panel && !href.includes("compose=")) {
          e.preventDefault();
          panel.scrollIntoView();
        }
      }}
      onNavigate={() => document.getElementById("compose")?.scrollIntoView()}
      className={className}
    >
      {children}
    </Link>
  );
}
