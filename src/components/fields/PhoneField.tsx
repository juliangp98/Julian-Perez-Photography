"use client";

import { useState, type ReactNode } from "react";
import Field, { controlClass, errorId } from "./Field";
import { formatPhone, isCompletePhone } from "@/lib/field-format";

// Phone input that masks to "(703) 555-1234" as the user types. The stored
// value is the formatted string; `normalizeE164` (sms.ts) strips it back to
// digits server-side. Flags a too-short number on blur.
export default function PhoneField({
  id,
  name,
  label = "Phone",
  value,
  onChange,
  required,
  help,
  error,
  placeholder = "(703) 555-1234",
  autoComplete = "tel",
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
  const internalError =
    touched && value.trim() && !isCompletePhone(value)
      ? "Enter a 10-digit phone number."
      : undefined;
  const shownError = error || internalError;
  return (
    <Field id={id} label={label} required={required} help={help} error={shownError}>
      <input
        id={id}
        name={name}
        type="tel"
        inputMode="tel"
        value={value}
        onChange={(e) => onChange(formatPhone(e.target.value))}
        onBlur={() => setTouched(true)}
        placeholder={placeholder}
        autoComplete={autoComplete}
        aria-invalid={shownError ? true : undefined}
        aria-describedby={shownError ? errorId(id) : undefined}
        className={controlClass(!!shownError)}
      />
    </Field>
  );
}
