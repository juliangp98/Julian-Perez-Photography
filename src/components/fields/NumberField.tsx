"use client";

import type { ReactNode } from "react";
import Field, { controlClass, errorId } from "./Field";

// Numeric input. Defaults to a non-negative integer (guest counts etc.) —
// strips anything but digits so a stray "-" or "e" can't slip through.
export default function NumberField({
  id,
  name,
  label,
  value,
  onChange,
  required,
  help,
  error,
  placeholder,
  min = 0,
  integer = true,
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
  min?: number;
  integer?: boolean;
}) {
  return (
    <Field id={id} label={label} required={required} help={help} error={error}>
      <input
        id={id}
        name={name}
        type="number"
        inputMode="numeric"
        min={min}
        step={integer ? 1 : undefined}
        value={value}
        onChange={(e) =>
          onChange(integer ? e.target.value.replace(/[^\d]/g, "") : e.target.value)
        }
        placeholder={placeholder}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId(id) : undefined}
        className={controlClass(!!error)}
      />
    </Field>
  );
}
