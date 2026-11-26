import type { ReactNode } from "react";
import Panel from "./Panel";

// RailCard is the admin project page's rail module; Detail is the labeled
// field both project pages (admin and portal) use. Server-safe.

export function RailCard({
  title,
  tone = "default",
  children,
}: {
  title: string;
  tone?: "default" | "danger";
  children: ReactNode;
}) {
  return (
    <Panel tone={tone}>
      <h2 className={`font-serif text-xl ${tone === "danger" ? "text-danger" : ""}`}>{title}</h2>
      <div className="mt-4">{children}</div>
    </Panel>
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
      <div className="text-xs uppercase tracking-[0.18em] text-muted">
        {label}
      </div>
      <div className={`mt-1 text-sm ${preLine ? "whitespace-pre-line" : ""}`}>
        {value}
      </div>
    </div>
  );
}
