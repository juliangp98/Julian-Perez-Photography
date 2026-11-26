"use client";

import type { ReactNode } from "react";
import Field, { controlClass, errorId } from "./Field";

// Plain text/url input on the shared chrome. Smart variants (phone, email,
// budget, date, location) live in their own files.
export default function TextField({
  id,
  name,
  label,
  value,
  onChange,
  required,
  help,
  error,
  placeholder,
  type = "text",
  autoComplete,
  onBlur,
  maxLength,
}: {
  id: string;
  name?: string;
  label?: ReactNode;
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
  help?: ReactNode;
  error?: string;
  placeholder?: string;
  type?: "text" | "url";
  autoComplete?: string;
  onBlur?: () => void;
  maxLength?: number;
}) {
  return (
    <Field id={id} label={label} required={required} help={help} error={error}>
      <input
        id={id}
        name={name}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        placeholder={placeholder}
        autoComplete={autoComplete}
        maxLength={maxLength}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId(id) : undefined}
        className={controlClass(!!error)}
      />
    </Field>
  );
}
