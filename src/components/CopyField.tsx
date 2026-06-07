"use client";

// A read-only field with a one-click Copy button — used across the admin AI
// content tools (journal drafts, service/portfolio copy) so Julian can lift each
// piece into Sanity Studio.

import { useState } from "react";

export default function CopyField({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard unavailable — no-op */
    }
  }
  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <div className="text-xs uppercase tracking-[0.18em] text-[var(--muted)]">
          {label}
        </div>
        <button
          type="button"
          onClick={copy}
          className="text-xs underline underline-offset-4 hover:text-[var(--accent)]"
        >
          {copied ? "Copied ✓" : "Copy"}
        </button>
      </div>
      <p className="mt-1.5 whitespace-pre-line break-words rounded border border-[var(--border)] bg-white p-3 text-sm leading-relaxed">
        {value}
      </p>
    </div>
  );
}
