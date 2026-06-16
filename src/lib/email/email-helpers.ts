// Small formatting helpers shared by the inquiry + questionnaire email
// routes. Kept separate from email-templates.tsx (which is React) so
// non-JSX callers don't pay the renderer import cost.

import { formatHumanDate } from "@/lib/field-format";

/**
 * Renders the ` — Aug 15, 2026` trailing clause for an email subject
 * line when an event/wedding date has been supplied. Returns an empty
 * string when the input is missing or unparseable, so it's always safe
 * to concatenate.
 *
 * Accepts ISO dates (YYYY-MM-DD from native `<input type="date">`) and
 * will do a best-effort parse of anything else — an unparseable value
 * is better treated as "no date known" than thrown into the subject
 * verbatim.
 */
export function formatSubjectDate(value: unknown): string {
  if (typeof value !== "string") return "";
  const formatted = formatHumanDate(value, { month: "short" });
  return formatted ? ` — ${formatted}` : "";
}

/**
 * The verified `from` for all Resend transactional mail. Defaults to the
 * studio's own domain — not the shared `resend.dev` sandbox sender, which
 * hurts deliverability — and is overridable with `RESEND_FROM` (set this in
 * the environment once the domain is verified in Resend). Replies are routed
 * to Julian's inbox via each sender's `replyTo`, so no domain mailbox is
 * required to receive them.
 */
export function resendFrom(): string {
  const from =
    process.env.RESEND_FROM ||
    "Julian Perez Photography <noreply@julianperezphotography.com>";
  // The `onboarding@resend.dev` sandbox sender silently delivers ONLY to your
  // own Resend account email — every other recipient is rejected with a 403,
  // which the send routes swallow (anti-enumeration). Warn loudly so a stray
  // RESEND_FROM override never breaks client mail unnoticed again.
  if (from.includes("onboarding@resend.dev")) {
    console.warn(
      "[email] RESEND_FROM is the resend.dev sandbox sender — it only delivers to your own Resend account email. Set RESEND_FROM to an address on your verified domain (e.g. noreply@julianperezphotography.com).",
    );
  }
  return from;
}
