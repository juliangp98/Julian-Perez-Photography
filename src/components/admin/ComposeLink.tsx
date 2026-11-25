"use client";

import Link from "next/link";
import type { ReactNode } from "react";

// A link that opens the project page's Compose panel, on the Messages tab, on
// a template. The assessment, the next step and a project's links all hand a
// client email to Compose this way. `href` is a "?compose=<template id>…
// #compose" address on the project page. A same-page change like this leaves
// the scroll where it is, so the navigation brings the panel into view; when
// it comes from another tab, the panel scrolls itself into view as it opens
// (a click that opens a new tab leaves this page alone).
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
      onNavigate={() => document.getElementById("compose")?.scrollIntoView()}
      className={className}
    >
      {children}
    </Link>
  );
}
