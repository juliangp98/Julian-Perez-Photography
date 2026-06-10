"use client";

import type { ReactNode } from "react";

// One pill for every generative-AI action on the site, so they all read as the
// same kind of tool: an accent-outlined pill marked with ✨, with built-in
// loading + disabled states. Callers pass the plain label (no ✨) and a
// `loading` flag; the pill swaps in `loadingLabel` while a request is in flight.
export default function AiButton({
  onClick,
  children,
  loading = false,
  loadingLabel = "Working…",
  disabled = false,
  size = "md",
  title,
  type = "button",
  className = "",
}: {
  onClick?: () => void;
  children: ReactNode;
  loading?: boolean;
  loadingLabel?: string;
  disabled?: boolean;
  size?: "sm" | "md";
  title?: string;
  type?: "button" | "submit";
  className?: string;
}) {
  const sizeCls = size === "sm" ? "px-3 py-1.5 text-xs" : "px-4 py-2 text-sm";
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      title={title}
      aria-busy={loading || undefined}
      className={`inline-flex items-center gap-1.5 rounded-full border border-[var(--accent)] font-medium text-[var(--accent)] transition hover:bg-[var(--accent)] hover:text-white disabled:opacity-50 ${sizeCls} ${className}`.trim()}
    >
      <span aria-hidden>✨</span>
      <span>{loading ? loadingLabel : children}</span>
    </button>
  );
}
