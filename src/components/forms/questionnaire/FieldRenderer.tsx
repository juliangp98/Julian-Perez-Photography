"use client";

import AssistedTextarea, {
  type AssistContext,
} from "@/components/forms/AssistedTextarea";
import TextField from "@/components/ui/fields/TextField";
import EmailField from "@/components/ui/fields/EmailField";
import PhoneField from "@/components/ui/fields/PhoneField";
import NumberField from "@/components/ui/fields/NumberField";
import DateField from "@/components/ui/fields/DateField";
import LocationField from "@/components/ui/fields/LocationField";
import SelectField from "@/components/ui/fields/SelectField";
import { inputClass, labelClass } from "@/components/ui/fields/Field";
import type { Field } from "@/lib/questionnaires";
import { resolvePackageOptions } from "@/lib/questionnaires";
import type { Value } from "./types";
import FileField from "./FileField";

// Canonical venue/address field ids that render with Google-Places autocomplete
// (free text retained). Matched by id so the harmonized venue fields across
// every questionnaire pick it up without retyping each schema entry; an explicit
// `type: "location"` works too.
const LOCATION_FIELD_IDS = new Set([
  "venueName",
  "venueAddress",
  "gettingReadyAddress",
  "partnerGettingReadyAddress",
  "receptionVenue",
]);

// ----------------------------------------------------------------------------
// Field renderer
// ----------------------------------------------------------------------------

export default function FieldRenderer({
  field,
  value,
  onChange,
  slug,
  aiEnabled,
  getAssistContext,
}: {
  field: Field;
  value: Value | undefined;
  onChange: (v: Value) => void;
  slug: string;
  aiEnabled?: boolean;
  getAssistContext?: () => AssistContext;
}) {

  const labelEl = (
    <label htmlFor={field.id} className={labelClass}>
      {field.label}
      {field.required && <span className="text-[var(--accent)]"> *</span>}
    </label>
  );
  const helpEl = field.help ? (
    <p className="mt-1.5 text-xs text-[var(--muted)]">{field.help}</p>
  ) : null;

  const str = (value as string) || "";

  // Address / venue fields → Places autocomplete (free text retained). Matched
  // by explicit type or canonical id.
  if (field.type === "location" || LOCATION_FIELD_IDS.has(field.id)) {
    return (
      <LocationField
        id={field.id}
        label={field.label}
        required={field.required}
        help={field.help}
        value={str}
        onChange={(v) => onChange(v)}
        valueKind={field.id === "venueName" ? "name" : "address"}
        placeholder={field.placeholder ?? "Search a venue or address…"}
      />
    );
  }

  switch (field.type) {
    case "text":
      return (
        <TextField
          id={field.id}
          label={field.label}
          required={field.required}
          help={field.help}
          value={str}
          onChange={(v) => onChange(v)}
          placeholder={field.placeholder}
        />
      );
    case "email":
      return (
        <EmailField
          id={field.id}
          label={field.label}
          required={field.required}
          help={field.help}
          value={str}
          onChange={(v) => onChange(v)}
          placeholder={field.placeholder}
        />
      );
    case "tel":
      return (
        <PhoneField
          id={field.id}
          label={field.label}
          required={field.required}
          help={field.help}
          value={str}
          onChange={(v) => onChange(v)}
          placeholder={field.placeholder}
        />
      );
    case "number":
      return (
        <NumberField
          id={field.id}
          label={field.label}
          required={field.required}
          help={field.help}
          value={str}
          onChange={(v) => onChange(v)}
          placeholder={field.placeholder}
        />
      );
    case "date":
      return (
        <DateField
          id={field.id}
          label={field.label}
          required={field.required}
          help={field.help}
          value={str}
          onChange={(v) => onChange(v)}
        />
      );
    case "time":
      return (
        <div>
          {labelEl}
          <input
            id={field.id}
            type="time"
            value={(value as string) || ""}
            onChange={(e) => onChange(e.target.value)}
            className={inputClass}
          />
          {helpEl}
        </div>
      );
    case "textarea":
      return (
        <div>
          {labelEl}
          <AssistedTextarea
            id={field.id}
            rows={4}
            value={(value as string) || ""}
            onChange={(v) => onChange(v)}
            placeholder={field.placeholder}
            textareaClassName={inputClass}
            assist={{
              kind: "questionnaire",
              question: field.label,
              service: slug,
              enabled: !!aiEnabled,
              getContext: getAssistContext,
            }}
          />
          {helpEl}
        </div>
      );
    case "select":
      return (
        <SelectField
          id={field.id}
          label={field.label}
          required={field.required}
          help={field.help}
          value={(value as string) || ""}
          onChange={onChange}
          placeholder="Select…"
          options={field.options || []}
        />
      );
    case "radio":
      return (
        <div>
          {labelEl}
          <div className="grid gap-2 mt-1">
            {(field.options || []).map((opt) => (
              <label
                key={opt}
                className="flex items-start gap-3 cursor-pointer text-sm"
              >
                <input
                  type="radio"
                  name={field.id}
                  value={opt}
                  checked={value === opt}
                  onChange={() => onChange(opt)}
                  className="mt-1"
                />
                <span>{opt}</span>
              </label>
            ))}
          </div>
          {helpEl}
        </div>
      );
    case "checkbox": {
      // A single-checkbox URL prefill arrives as a lone string (Next returns a
      // string, not an array, for a non-repeated key) — wrap it so it checks.
      const arr = Array.isArray(value) ? value : value ? [value] : [];
      return (
        <div>
          {labelEl}
          <div className="grid gap-2 mt-1">
            {(field.options || []).map((opt) => (
              <label
                key={opt}
                className="flex items-start gap-3 cursor-pointer text-sm"
              >
                <input
                  type="checkbox"
                  value={opt}
                  checked={arr.includes(opt)}
                  onChange={(e) => {
                    if (e.target.checked) onChange([...arr, opt]);
                    else onChange(arr.filter((v) => v !== opt));
                  }}
                  className="mt-1"
                />
                <span>{opt}</span>
              </label>
            ))}
          </div>
          {helpEl}
        </div>
      );
    }
    case "package": {
      const opts = resolvePackageOptions(slug);
      return (
        <SelectField
          id={field.id}
          label={field.label}
          required={field.required}
          help={field.help}
          value={(value as string) || ""}
          onChange={onChange}
          placeholder="Select a package…"
          options={opts}
        />
      );
    }
    case "file":
      return (
        <FileField
          field={field}
          value={value}
          onChange={onChange}
          slug={slug}
          labelEl={labelEl}
          helpEl={helpEl}
        />
      );
    default:
      return null;
  }
}

