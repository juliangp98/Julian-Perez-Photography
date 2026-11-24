import type { ReactNode } from "react";

// The site's white content box. CalloutCard (a closing call to action) and
// RailCard (a labeled rail module) are built on it. `tone` sets the border;
// `size` the padding. Extra classes append via `className`.
const TONES = {
  default: "border-border",
  accent: "border-accent",
  danger: "border-danger/40",
};

export default function Panel({
  tone = "default",
  size = "md",
  className = "",
  children,
}: {
  tone?: keyof typeof TONES;
  size?: "md" | "lg";
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      className={`rounded-lg border bg-white ${TONES[tone]} ${size === "lg" ? "p-8" : "p-5"} ${className}`.trim()}
    >
      {children}
    </div>
  );
}
