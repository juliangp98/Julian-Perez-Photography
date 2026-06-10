"use client";

import type { ReactNode } from "react";
import Field, { controlClass, errorId } from "./Field";

export type SelectOption = { value: string; label: string };

// Dropdown on the shared chrome — the one source for labeled form selects.
// `options` takes plain strings (value = label) or {value, label} pairs.
// `placeholder` renders a leading empty option, locked (disabled) by default so
// a required choice can't return to empty; pass `clearable` when re-selecting
// the empty option is meaningful ("Not sure yet", clearing a package). Extra
// content tied to the selection — e.g. a conditional "other" input — renders
// below the select via `children`.
export default function SelectField({
  id,
  name,
  label,
  value,
  onChange,
  options,
  placeholder,
  clearable,
  required,
  help,
  error,
  disabled,
  children,
}: {
  id: string;
  name?: string;
  label?: ReactNode;
  value: string;
  onChange: (v: string) => void;
  options: ReadonlyArray<string | SelectOption>;
  placeholder?: string;
  clearable?: boolean;
  required?: boolean;
  help?: ReactNode;
  error?: string;
  disabled?: boolean;
  children?: ReactNode;
}) {
  return (
    <Field id={id} label={label} required={required} help={help} error={error}>
      <select
        id={id}
        name={name}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId(id) : undefined}
        className={controlClass(!!error, "disabled:opacity-50")}
      >
        {placeholder !== undefined && (
          <option value="" disabled={!clearable}>
            {placeholder}
          </option>
        )}
        {options.map((o) => {
          const opt = typeof o === "string" ? { value: o, label: o } : o;
          return (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          );
        })}
      </select>
      {children}
    </Field>
  );
}
