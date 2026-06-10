"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import Field, { controlClass, errorId } from "./Field";
import type { PlacePrediction } from "@/lib/places";

// Address / venue input with Google-Places suggestions. As the user types (≥3
// chars, debounced) it queries `/api/places/autocomplete` and shows a
// keyboard-navigable combobox of results; selecting one fills the field. Free
// text is always retained — typing a custom value and ignoring the list just
// keeps what was typed. `valueKind` picks whether a selection fills the venue
// name or the full address.
export default function LocationField({
  id,
  name,
  label,
  value,
  onChange,
  required,
  help,
  error,
  placeholder,
  valueKind = "address",
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
  valueKind?: "name" | "address";
}) {
  const [predictions, setPredictions] = useState<PlacePrediction[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const rootRef = useRef<HTMLDivElement>(null);
  const justSelected = useRef(false);
  const listId = useId();

  // Debounced lookup. Skips the fetch immediately after a selection so picking
  // a result doesn't bounce the list back open. All state updates happen inside
  // the timeout callback (never synchronously in the effect body).
  useEffect(() => {
    if (justSelected.current) {
      justSelected.current = false;
      return;
    }
    const q = value.trim();
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      if (q.length < 3) {
        setPredictions([]);
        setOpen(false);
        return;
      }
      try {
        const res = await fetch("/api/places/autocomplete", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ input: q }),
          signal: ctrl.signal,
        });
        if (!res.ok) return;
        const data = await res.json();
        const list: PlacePrediction[] = Array.isArray(data.predictions)
          ? data.predictions
          : [];
        setPredictions(list);
        setOpen(list.length > 0);
        setActive(-1);
      } catch {
        /* aborted or offline — free text still works */
      }
    }, 250);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [value]);

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  function choose(p: PlacePrediction) {
    justSelected.current = true;
    onChange(valueKind === "name" ? p.mainText : p.fullText);
    setOpen(false);
    setPredictions([]);
    setActive(-1);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (!open || predictions.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, predictions.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === "Enter" && active >= 0) {
      e.preventDefault();
      choose(predictions[active]);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <Field id={id} label={label} required={required} help={help} error={error}>
      <div className="relative" ref={rootRef}>
        <input
          id={id}
          name={name}
          type="text"
          value={value}
          autoComplete="off"
          role="combobox"
          aria-expanded={open}
          aria-controls={open ? listId : undefined}
          aria-autocomplete="list"
          aria-activedescendant={active >= 0 ? `${listId}-${active}` : undefined}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder={placeholder}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId(id) : undefined}
          className={controlClass(!!error)}
        />
        {open && predictions.length > 0 && (
          <ul
            id={listId}
            role="listbox"
            className="absolute left-0 right-0 z-30 mt-1 max-h-64 overflow-auto rounded-lg border border-[var(--border)] bg-white py-1 shadow-xl"
          >
            {predictions.map((p, i) => (
              <li
                key={p.placeId || `${i}`}
                id={`${listId}-${i}`}
                role="option"
                aria-selected={i === active}
                onMouseDown={(e) => {
                  e.preventDefault();
                  choose(p);
                }}
                onMouseEnter={() => setActive(i)}
                className={`cursor-pointer px-4 py-2 text-sm ${
                  i === active ? "bg-[var(--accent)]/10" : ""
                }`}
              >
                <div className="font-medium">{p.mainText}</div>
                {p.secondaryText && (
                  <div className="text-xs text-[var(--muted)]">
                    {p.secondaryText}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </Field>
  );
}
