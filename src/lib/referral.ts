// Curated "How did you hear about me?" options.
//
// Julian needs to see at a glance where bookings come from; free text
// historically produced a mess of variants ("Instagram", "instagram",
// "insta", "IG friend", blank). A dropdown normalizes the dataset, and options
// that carry a `detail` prompt reveal a companion input so the specific group,
// venue or vendor comes through with the channel ("Venue: Foxchase Manor"). The
// long tail stays visible under "Other".
//
// The empty-string sentinel is the default "Select one…" placeholder so the
// field stays visually optional while still collecting clean data when filled.
//
// The companion input travels as `referralOther` on every form and API payload
// (the name predates the per-option prompts). The API routes tag the owner
// email's subject with `[via: <Label>]` for inbox filtering, and the client
// record stores the formatted "Label: detail" string.

type ReferralOption = {
  value: string;
  label: string;
  // Placeholder for the companion input. Options without one never show it.
  detail?: string;
};

export const REFERRAL_OPTIONS: readonly ReferralOption[] = [
  { value: "", label: "Select one…" },
  { value: "instagram", label: "Instagram" },
  { value: "facebook-group", label: "Facebook group", detail: "Which group? (optional)" },
  { value: "google", label: "Google search" },
  { value: "friend-family", label: "Friend or family" },
  { value: "venue", label: "Venue", detail: "Which venue? (optional)" },
  { value: "vendor", label: "Planner or another vendor", detail: "Which vendor? (optional)" },
  { value: "wedding-wire", label: "The Knot / WeddingWire" },
  { value: "returning-client", label: "Returning client" },
  { value: "other", label: "Other", detail: "Tell me more (optional)" },
];

// Human-readable labels keyed by stored value. Used server-side so email
// bodies render "Instagram" rather than "instagram".
export const REFERRAL_LABELS: Record<string, string> = Object.fromEntries(
  REFERRAL_OPTIONS.map((o) => [o.value, o.label]),
);

const REFERRAL_DETAIL: Record<string, string> = Object.fromEntries(
  REFERRAL_OPTIONS.flatMap((o) => (o.detail ? [[o.value, o.detail]] : [])),
);

// The companion-input placeholder for a selected option, or null when that
// option doesn't ask for detail.
export function referralDetailPrompt(referral: string | undefined): string | null {
  return (referral && REFERRAL_DETAIL[referral]) || null;
}

// Resolve a submitted value plus optional companion detail into one display
// string. The detail is folded in only for options that ask for it, so a value
// left behind by a since-changed dropdown never leaks through. Returns "" for
// no answer, so a record's source tally counts only real ones.
export function formatReferral(
  referral: string | undefined,
  referralOther: string | undefined,
): string {
  if (!referral) return "";
  const base = REFERRAL_LABELS[referral] ?? referral;
  const detail = referralOther?.trim();
  return detail && referralDetailPrompt(referral) ? `${base}: ${detail}` : base;
}
