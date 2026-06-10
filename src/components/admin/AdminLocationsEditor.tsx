"use client";

import TextField from "@/components/ui/fields/TextField";
import LocationField from "@/components/ui/fields/LocationField";
import { labelClass } from "@/components/ui/fields/Field";

export type LocationEntry = { label?: string; address?: string; notes?: string };

// Controlled list editor for a project's venues/addresses — labeled rows with
// Places autocomplete on the address, add/remove controls. The parent owns the
// array and receives every change through `onChange`.
export default function AdminLocationsEditor({
  locations,
  onChange,
}: {
  locations: LocationEntry[];
  onChange: (next: LocationEntry[]) => void;
}) {
  function update(i: number, patch: Partial<LocationEntry>) {
    onChange(locations.map((loc, j) => (j === i ? { ...loc, ...patch } : loc)));
  }

  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className={labelClass}>Locations</span>
        <button
          type="button"
          onClick={() => onChange([...locations, {}])}
          className="rounded-full border border-[var(--foreground)] px-3 py-1 text-xs transition hover:bg-[var(--foreground)] hover:text-[var(--background)]"
        >
          + Add location
        </button>
      </div>
      {locations.length === 0 ? (
        <p className="text-sm text-[var(--muted)]">
          No locations yet — add a venue or address.
        </p>
      ) : (
        <div className="space-y-4">
          {locations.map((loc, i) => (
            <div
              key={i}
              className="space-y-3 rounded-lg border border-[var(--border)] p-4"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs uppercase tracking-[0.18em] text-[var(--muted)]">
                  Location {i + 1}
                </span>
                <button
                  type="button"
                  onClick={() => onChange(locations.filter((_, j) => j !== i))}
                  className="text-xs text-[var(--muted)] transition hover:text-red-700"
                >
                  Remove
                </button>
              </div>
              <TextField
                id={`a-loc-label-${i}`}
                label="Label / venue name"
                value={loc.label ?? ""}
                onChange={(val) => update(i, { label: val })}
              />
              <LocationField
                id={`a-loc-address-${i}`}
                label="Address"
                value={loc.address ?? ""}
                onChange={(val) => update(i, { address: val })}
                valueKind="address"
                placeholder="Search an address…"
              />
              <TextField
                id={`a-loc-notes-${i}`}
                label="Notes"
                value={loc.notes ?? ""}
                onChange={(val) => update(i, { notes: val })}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
