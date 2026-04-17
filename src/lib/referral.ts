// Curated "How did you hear about me?" options.
//
// Julian needs to see at a glance where bookings come from — free-text
// historically produced a mess of variants ("Instagram", "instagram",
// "insta", "IG friend", blank). A dropdown normalizes the dataset; the
// "Other" option + free-text fallback keeps the long tail visible.
//
// The empty-string sentinel is the default "Select one…" placeholder so
// the field stays visually optional while still collecting clean data
// when filled.
//
// Full quarterly analytics requires a submission archive (backlog #11);
// for now the API routes append `[via: <Label>]` to Julian's inbox so he
// can filter/tally manually.

export const REFERRAL_OPTIONS = [
  { value: "", label: "Select one…" },
  { value: "instagram", label: "Instagram" },
  { value: "google", label: "Google search" },
  { value: "friend-family", label: "Friend or family" },
  { value: "venue", label: "Venue or vendor referral" },
  { value: "wedding-wire", label: "The Knot / WeddingWire" },
  { value: "returning-client", label: "Returning client" },
  { value: "other", label: "Other" },
] as const;

export type ReferralValue = (typeof REFERRAL_OPTIONS)[number]["value"];

// Human-readable labels keyed by stored value. Used server-side so email
// bodies render "Instagram" rather than "instagram".
export const REFERRAL_LABELS: Record<string, string> = Object.fromEntries(
  REFERRAL_OPTIONS.map((o) => [o.value, o.label]),
);

// Resolve a submitted value + optional free-text "Other" detail into a
// single display string for emails. Returns "—" for empty.
export function formatReferral(
  referral: string | undefined,
  referralOther: string | undefined,
): string {
  if (!referral) return "—";
  const base = REFERRAL_LABELS[referral] ?? referral;
  if (referral === "other" && referralOther) return `${base} — ${referralOther}`;
  return base;
}
