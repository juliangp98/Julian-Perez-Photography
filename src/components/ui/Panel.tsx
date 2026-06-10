import type { ReactNode } from "react";

// Neutral white content panel — the default box for grouped content. Sits
// alongside the two specialized cards: CalloutCard (accent-bordered CTA) and
// RailCard (labeled rail module). Extra classes (margins, spacing, responsive
// padding, hover states) append via `className`.
export default function Panel({
  className = "",
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      className={`rounded-lg border border-[var(--border)] bg-white p-5 ${className}`.trim()}
    >
      {children}
    </div>
  );
}
