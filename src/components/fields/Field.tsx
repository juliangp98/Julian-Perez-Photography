import type { ReactNode } from "react";

// Shared chrome + classes for every form control on the site, so the input
// styling, required marker, help text, and inline-error wiring live in one place
// instead of being copy-pasted into each form. The typed fields in this folder
// (TextField, EmailField, PhoneField, DateField, BudgetField, NumberField,
// LocationField) render their control as `children` inside this wrapper.

export const inputClass =
  "w-full px-4 py-3 rounded border border-[var(--border)] bg-white focus:outline-none focus:border-[var(--foreground)] transition";
const inputErrorClass = "border-red-500 focus:border-red-500";
export const labelClass = "block text-sm font-medium mb-1.5";

// The control class with an error outline when `error` is set.
export function controlClass(error?: boolean, extra = ""): string {
  return `${inputClass} ${error ? inputErrorClass : ""} ${extra}`.trim();
}

// Stable id for a field's error node, referenced by `aria-describedby`.
export function errorId(id: string): string {
  return `${id}-error`;
}

export default function Field({
  id,
  label,
  required,
  help,
  error,
  children,
}: {
  id: string;
  label?: ReactNode;
  required?: boolean;
  help?: ReactNode;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div>
      {label && (
        <label htmlFor={id} className={labelClass}>
          {label}
          {required && (
            <span className="text-[var(--accent)]" aria-hidden>
              {" "}
              *
            </span>
          )}
        </label>
      )}
      {children}
      {error && (
        <p id={errorId(id)} className="mt-1 text-sm text-red-700">
          {error}
        </p>
      )}
      {help && !error && (
        <p className="mt-1.5 text-xs text-[var(--muted)]">{help}</p>
      )}
    </div>
  );
}
