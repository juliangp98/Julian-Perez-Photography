import type { ReactNode } from "react";

// Shared rail modules for the project detail pages (admin + client), so both
// portals render reference info identically. Pure presentational — safe to use
// from server components.

export function RailCard({
  title,
  tone = "default",
  children,
}: {
  title: string;
  tone?: "default" | "danger";
  children: ReactNode;
}) {
  const border =
    tone === "danger" ? "border-red-300" : "border-[var(--border)]";
  const heading = tone === "danger" ? "text-red-700" : "";
  return (
    <div className={`rounded-lg border ${border} bg-white p-5`}>
      <h2 className={`font-serif text-xl ${heading}`}>{title}</h2>
      <div className="mt-4">{children}</div>
    </div>
  );
}

// A labeled read-only field. Renders nothing when the value is empty. `preLine`
// preserves newlines (for multi-line values like a locations list); `className`
// lets a caller add list spacing (e.g. `py-2` inside a divided list).
export function Detail({
  label,
  value,
  className,
  preLine,
}: {
  label: string;
  value?: string;
  className?: string;
  preLine?: boolean;
}) {
  if (!value) return null;
  return (
    <div className={className}>
      <div className="text-xs uppercase tracking-[0.18em] text-[var(--muted)]">
        {label}
      </div>
      <div className={`mt-1 text-sm ${preLine ? "whitespace-pre-line" : ""}`}>
        {value}
      </div>
    </div>
  );
}
