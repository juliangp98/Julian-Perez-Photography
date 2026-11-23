"use client";

import type { Field } from "@/lib/questionnaires";
import { REFERRAL_OPTIONS, referralDetailPrompt } from "@/lib/referral";
import SelectField from "@/components/ui/fields/SelectField";
import { inputClass } from "@/components/ui/fields/Field";

// ----------------------------------------------------------------------------
// Referral field — curated dropdown with a companion free-text input for the
// options that ask for detail (which group, venue, or vendor; "Other").
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
  const detailPrompt = referralDetailPrompt(value);
  return (
    <SelectField
      id={field.id}
      label={field.label}
      required={field.required}
      help={field.help}
      value={value || ""}
      onChange={(v) => {
        onChange(v);
        // A new choice clears the companion detail so a venue name can't
        // ride along under a different channel.
        onOtherChange("");
      }}
      options={REFERRAL_OPTIONS}
    >
      {detailPrompt && (
        <input
          id="referralOther"
          name="referralOther"
          aria-label={detailPrompt}
          value={otherValue || ""}
          onChange={(e) => onOtherChange(e.target.value)}
          placeholder={detailPrompt}
          className={`${inputClass} mt-2`}
        />
      )}
    </SelectField>
  );
}
