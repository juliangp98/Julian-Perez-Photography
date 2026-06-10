"use client";

import type { Field } from "@/lib/questionnaires";
import { REFERRAL_OPTIONS } from "@/lib/referral";
import SelectField from "@/components/ui/fields/SelectField";
import { inputClass } from "@/components/ui/fields/Field";

// ----------------------------------------------------------------------------
// Referral field — curated dropdown with an "Other" free-text fallback.
// Rendered in place of the generic text renderer for the `referral` field so
// the inquiry + questionnaire data stays normalized site-wide.
// ----------------------------------------------------------------------------

export default function ReferralField({
  field,
  value,
  otherValue,
  onChange,
  onOtherChange,
}: {
  field: Field;
  value: string | undefined;
  otherValue: string | undefined;
  onChange: (v: string) => void;
  onOtherChange: (v: string) => void;
}) {
  return (
    <SelectField
      id={field.id}
      label={field.label}
      required={field.required}
      help={field.help}
      value={value || ""}
      onChange={onChange}
      options={REFERRAL_OPTIONS}
    >
      {value === "other" && (
        <input
          id="referralOther"
          name="referralOther"
          value={otherValue || ""}
          onChange={(e) => onOtherChange(e.target.value)}
          placeholder="Tell me more (optional)"
          className={`${inputClass} mt-2`}
        />
      )}
    </SelectField>
  );
}

