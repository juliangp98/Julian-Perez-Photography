"use client";

import { useState, type ReactNode } from "react";
import Field, { controlClass, errorId } from "./Field";
import { isValidEmail, suggestEmailFix } from "@/lib/field-format";

// Email input that, on blur, flags an invalid address and offers a one-click
// fix for a common domain typo ("Did you mean name@gmail.com?"). An external
// `error` (e.g. a required-on-submit error from the form) takes precedence.
export default function EmailField({
  id,
  name,
  label = "Email",
  value,
  onChange,
  required,
  help,
  error,
  placeholder,
  autoComplete = "email",
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
  autoComplete?: string;
}) {
  const [touched, setTouched] = useState(false);
  const trimmed = value.trim();
  const formatError =
    touched && trimmed && !isValidEmail(trimmed)
      ? "Please enter a valid email address."
      : undefined;
  const suggestion = touched && trimmed ? suggestEmailFix(trimmed) : null;
  const shownError = error || formatError;
  return (
    <Field id={id} label={label} required={required} help={help} error={shownError}>
      <input
        id={id}
        name={name}
        type="email"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={() => setTouched(true)}
        placeholder={placeholder}
        autoComplete={autoComplete}
        aria-invalid={shownError ? true : undefined}
        aria-describedby={shownError ? errorId(id) : undefined}
        className={controlClass(!!shownError)}
      />
      {suggestion && (
        <button
          type="button"
          onClick={() => {
            onChange(suggestion);
            setTouched(true);
          }}
          className="mt-1 text-sm text-[var(--accent)] underline underline-offset-2 transition hover:text-[var(--foreground)]"
        >
          Did you mean {suggestion}?
        </button>
      )}
    </Field>
  );
}
