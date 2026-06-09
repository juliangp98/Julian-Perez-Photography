"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { DayPicker } from "react-day-picker";
import "react-day-picker/style.css";
import Field, { controlClass, errorId } from "./Field";
import { maskDate, displayToIso, isoToDisplay } from "@/lib/field-format";

// Date entry that types as `MM/DD/YYYY` (auto-slashes, auto-advances) and opens
// a site-styled react-day-picker calendar (a callout-card popover, the selected
// day ringed in the brand accent). The stored `value` is ISO `yyyy-MM-dd`; a
// hidden `name` input carries it for FormData-based forms.
function isoFromDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;
}

// Map react-day-picker's theme variables onto the site palette: the selected
// day is ringed in --accent, today's number is --accent, hover/range tint is a
// soft accent wash.
const CALENDAR_THEME = {
  "--rdp-accent-color": "var(--accent)",
  "--rdp-accent-background-color":
    "color-mix(in srgb, var(--accent) 12%, white)",
} as React.CSSProperties;

export default function DateField({
  id,
  name,
  label,
  value,
  onChange,
  required,
  help,
  error,
  placeholder = "MM/DD/YYYY",
}: {
  id: string;
  name?: string;
  label?: ReactNode;
  value: string; // ISO yyyy-MM-dd
  onChange: (iso: string) => void;
  required?: boolean;
  help?: ReactNode;
  error?: string;
  placeholder?: string;
}) {
  const [display, setDisplay] = useState(() => isoToDisplay(value));
  const [open, setOpen] = useState(false);
  const [touched, setTouched] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  // Re-sync the visible text when the ISO value changes from outside (prefill).
  // Guarded so an incomplete in-progress entry (which maps to "") isn't wiped.
  useEffect(() => {
    if (displayToIso(display) !== value) setDisplay(isoToDisplay(value));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  // Dismiss the popover on outside click or Escape.
  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const selected = value ? new Date(`${value}T00:00:00`) : undefined;
  const invalidTyped =
    touched && display.trim() !== "" && !displayToIso(display);
  const shownError =
    error || (invalidTyped ? "Enter a valid date as MM/DD/YYYY." : undefined);

  function onType(raw: string) {
    const masked = maskDate(raw);
    setDisplay(masked);
    onChange(displayToIso(masked)); // "" while incomplete
  }

  function pick(date: Date | undefined) {
    if (!date) return;
    const iso = isoFromDate(date);
    setDisplay(isoToDisplay(iso));
    onChange(iso);
    setTouched(true);
    setOpen(false);
  }

  return (
    <Field id={id} label={label} required={required} help={help} error={shownError}>
      <div className="relative" ref={rootRef}>
        {name && <input type="hidden" name={name} value={value} />}
        <input
          id={id}
          type="text"
          inputMode="numeric"
          value={display}
          onChange={(e) => onType(e.target.value)}
          onBlur={() => setTouched(true)}
          placeholder={placeholder}
          autoComplete="off"
          aria-invalid={shownError ? true : undefined}
          aria-describedby={shownError ? errorId(id) : undefined}
          className={controlClass(!!shownError, "pr-11")}
        />
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-label={open ? "Close calendar" : "Open calendar"}
          aria-expanded={open}
          className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded p-2 text-[var(--muted)] transition hover:text-[var(--accent)]"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.6}
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-5 w-5"
            aria-hidden
          >
            <rect x="3" y="4.5" width="18" height="16" rx="2" />
            <path d="M3 9h18M8 3v3M16 3v3" />
          </svg>
        </button>
        {open && (
          <div
            className="absolute left-0 z-30 mt-2 rounded-lg border border-[var(--accent)] bg-white p-3 shadow-xl"
            style={CALENDAR_THEME}
          >
            <DayPicker
              mode="single"
              selected={selected}
              onSelect={pick}
              defaultMonth={selected}
              showOutsideDays
            />
          </div>
        )}
      </div>
    </Field>
  );
}
