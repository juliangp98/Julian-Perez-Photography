"use client";

import type { ReactNode } from "react";
import Field, { controlClass, errorId } from "./Field";
import { withDollar, formatBudget } from "@/lib/field-format";

// Budget input — a "$" appears as soon as you type, and a plain number is
// comma-grouped on blur. Ranges ("$2,500 – $3,500") are left as free text.
export default function BudgetField({
  id,
  name,
  label = "Budget",
  value,
  onChange,
  required,
  help,
  error,
  placeholder = "e.g. $2,500 – $3,500",
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
}) {
  return (
    <Field id={id} label={label} required={required} help={help} error={error}>
      <input
        id={id}
        name={name}
        inputMode="text"
        value={value}
        onChange={(e) => onChange(withDollar(e.target.value))}
        onBlur={(e) => onChange(formatBudget(e.target.value))}
        placeholder={placeholder}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId(id) : undefined}
        className={controlClass(!!error)}
      />
    </Field>
  );
}
