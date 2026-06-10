import Link from "next/link";

// The single source for the site's pill call-to-action buttons. Renders an
// internal `next/link`, or an external anchor when `external`. One place owns
// the variant colors and the size scale, so every CTA reads identically — no
// more drifting px-5/px-6 padding or one-off color combinations. (Interactive
// state buttons — form submit/save with disabled + loading — stay inline in
// their forms; this is for navigational CTAs.)

export type ButtonVariant = "primary" | "secondary" | "ghost";
export type ButtonSize = "sm" | "md" | "lg";

const BASE =
  "inline-flex items-center justify-center gap-2 rounded-full font-medium transition";

const SIZES: Record<ButtonSize, string> = {
  sm: "px-4 py-1.5 text-sm",
  md: "px-5 py-2.5 text-sm",
  lg: "px-6 py-3",
};

const VARIANTS: Record<ButtonVariant, string> = {
  primary: "bg-[var(--foreground)] text-[var(--background)] hover:opacity-90",
  secondary:
    "border border-[var(--foreground)] hover:bg-[var(--foreground)] hover:text-[var(--background)]",
  ghost: "border border-[var(--border)] hover:border-[var(--foreground)]",
};

export default function Button({
  href,
  external = false,
  variant = "primary",
  size = "md",
  className = "",
  children,
}: {
  href: string;
  external?: boolean;
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
  children: React.ReactNode;
}) {
  const cls = `${BASE} ${SIZES[size]} ${VARIANTS[variant]} ${className}`.trim();
  return external ? (
    <a href={href} target="_blank" rel="noreferrer" className={cls}>
      {children}
    </a>
  ) : (
    <Link href={href} className={cls}>
      {children}
    </Link>
  );
}
