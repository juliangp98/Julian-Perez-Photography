import type { SelectHTMLAttributes } from "react";
import { compactInputClass, controlClass } from "./Field";

// The site's one dropdown control. SelectField wraps it with a label; use it
// bare for compact pickers in tool bars and filters (give those an
// aria-label). Options and optgroups go in as children.
export default function Select({
  density = "regular",
  invalid = false,
  className = "",
  ...rest
}: Omit<SelectHTMLAttributes<HTMLSelectElement>, "size"> & {
  density?: "regular" | "compact";
  invalid?: boolean;
}) {
  const base = density === "compact" ? compactInputClass : controlClass(invalid, "disabled:opacity-50");
  return <select {...rest} className={`${base} ${className}`.trim()} />;
}
