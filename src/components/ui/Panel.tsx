import type { ReactNode } from "react";

// The site's white content box. CalloutCard (a closing call to action) and
// RailCard (a labeled rail module) are built on it. `tone` sets the border;
// `size` the padding; `surface` the fill, white or the page's own color for a
// box set inside another. Extra classes append via `className`.
const TONES = {
  default: "border-border",
  accent: "border-accent",
  danger: "border-danger/40",
};

export default function Panel({
  tone = "default",
  size = "md",
  surface = "white",
  className = "",
  children,
}: {
  tone?: keyof typeof TONES;
  size?: "md" | "lg";
  surface?: "white" | "background";
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      className={`rounded-lg border ${surface === "white" ? "bg-white" : "bg-background"} ${TONES[tone]} ${size === "lg" ? "p-8" : "p-5"} ${className}`.trim()}
    >
      {children}
    </div>
  );
}
