import Link from "next/link";
import type { ReactNode } from "react";

// Tiny inline-markdown renderer. Supports [label](href) only.
// Internal hrefs (starting with "/") render as <Link>; everything else as
// a new-tab <a>. Plain text segments are returned as strings so React can
// inline them inside paragraphs without extra wrappers.
const LINK_RE = /\[([^\]]+)\]\(([^)]+)\)/g;

export function renderInline(text: string): ReactNode[] {
  const out: ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let key = 0;

  LINK_RE.lastIndex = 0;
  while ((match = LINK_RE.exec(text)) !== null) {
    const [full, label, href] = match;
    if (match.index > lastIndex) {
      out.push(text.slice(lastIndex, match.index));
    }
    if (href.startsWith("/")) {
      out.push(
        <Link
          key={`l${key++}`}
          href={href}
          className="underline underline-offset-4 decoration-[var(--accent)] hover:text-[var(--accent)] transition"
        >
          {label}
        </Link>,
      );
    } else {
      out.push(
        <a
          key={`l${key++}`}
          href={href}
          target="_blank"
          rel="noreferrer"
          className="underline underline-offset-4 decoration-[var(--accent)] hover:text-[var(--accent)] transition"
        >
          {label}
        </a>,
      );
    }
    lastIndex = match.index + full.length;
  }
  if (lastIndex < text.length) {
    out.push(text.slice(lastIndex));
  }
  return out;
}
