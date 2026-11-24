import Link from "next/link";
import type { ButtonHTMLAttributes, ReactNode } from "react";

// The site's buttons. With `href` it renders a link (an anchor when external);
// without, a <button> that takes the usual button props plus `loading`, which
// disables it and swaps in `loadingLabel`. Variants and sizes live here only.

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "text";
export type ButtonSize = "sm" | "md" | "lg";

const PILL = "inline-flex items-center justify-center gap-2 rounded-full font-medium transition disabled:opacity-50";

const SIZES: Record<ButtonSize, string> = {
  sm: "px-4 py-1.5 text-xs",
  md: "px-5 py-2.5 text-sm",
  lg: "px-6 py-3",
};

const VARIANTS: Record<ButtonVariant, string> = {
  primary: "bg-foreground text-background hover:opacity-90",
  secondary: "border border-foreground hover:bg-foreground hover:text-background",
  ghost: "border border-border hover:border-foreground",
  danger: "border border-danger text-danger hover:bg-danger hover:text-white",
  text: "",
};

// A quiet inline action: small, muted, underlined on hover.
const TEXT =
  "inline-flex items-center gap-1 text-xs text-muted underline-offset-4 hover:text-foreground hover:underline transition disabled:opacity-50";

export function buttonClass(variant: ButtonVariant = "primary", size: ButtonSize = "md") {
  return variant === "text" ? TEXT : `${PILL} ${SIZES[size]} ${VARIANTS[variant]}`;
}

type Common = {
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
  children: ReactNode;
};
type AsLink = Common & { href: string; external?: boolean };
type AsButton = Common &
  Omit<ButtonHTMLAttributes<HTMLButtonElement>, "className" | "children"> & {
    href?: undefined;
    loading?: boolean;
    loadingLabel?: string;
  };

export default function Button(props: AsLink | AsButton) {
  const { variant = "primary", size = "md", className = "", children } = props;
  const cls = `${buttonClass(variant, size)} ${className}`.trim();

  if (props.href !== undefined) {
    return props.external ? (
      <a href={props.href} target="_blank" rel="noreferrer" className={cls}>
        {children}
      </a>
    ) : (
      <Link href={props.href} className={cls}>
        {children}
      </Link>
    );
  }

  const {
    loading = false,
    loadingLabel = "Working…",
    type = "button",
    disabled,
    variant: _v,
    size: _s,
    className: _c,
    children: _ch,
    ...rest
  } = props;
  void _v;
  void _s;
  void _c;
  void _ch;
  return (
    <button
      {...rest}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cls}
    >
      {loading ? loadingLabel : children}
    </button>
  );
}
