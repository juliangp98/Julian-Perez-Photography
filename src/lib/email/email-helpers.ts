// Small formatting helpers shared by the inquiry + questionnaire email
// routes. Kept separate from email-templates.tsx (which is React) so
// non-JSX callers don't pay the renderer import cost.

import { formatHumanDate } from "@/lib/field-format";
import { addressOf } from "./inbound";

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
  return formatted ? ` (${formatted})` : "";
}

// The sender of mail to clients: Julian, at the studio address, so a client
// can simply reply. A reply on a project's thread goes to its reply address
// (the Reply-To sendEmail sets) and lands on the thread; any other reply
// reaches julian@, which Cloudflare forwards to his inbox. Overridable with
// RESEND_FROM, an address on the domain verified in Resend.
export function resendFrom(): string {
  const from = process.env.RESEND_FROM || "Julian Perez <julian@julianperezphotography.com>";
  // The `onboarding@resend.dev` sandbox sender silently delivers ONLY to your
  // own Resend account email — every other recipient is rejected with a 403,
  // which the send routes swallow (anti-enumeration). Warn loudly so a stray
  // RESEND_FROM override never breaks client mail unnoticed again.
  if (from.includes("onboarding@resend.dev")) {
    console.warn(
      "[email] RESEND_FROM is the resend.dev sandbox sender. It only delivers to your own Resend account email. Set RESEND_FROM to an address on your verified domain (e.g. julian@julianperezphotography.com).",
    );
  }
  return from;
}

// The sender of the site's own alerts to Julian (new inquiries, the morning
// email, portal notices): noreply@ on the same domain, so they stand apart
// from client mail in his inbox rather than reading as sent by him.
export function alertsFrom(): string {
  const domain = addressOf(resendFrom()).split("@")[1] || "julianperezphotography.com";
  return `Julian Perez Photography <noreply@${domain}>`;
}
