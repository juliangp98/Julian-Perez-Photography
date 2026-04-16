// Small formatting helpers shared by the inquiry + questionnaire email
// routes. Kept separate from email-templates.tsx (which is React) so
// non-JSX callers don't pay the renderer import cost.

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
  if (typeof value !== "string" || !value.trim()) return "";

  // `new Date("2026-08-15")` parses as UTC midnight and can render as
  // the previous day in negative-offset locales. Detect the plain ISO
  // date form and build the Date from local components instead.
  const isoMatch = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const date = isoMatch
    ? new Date(
        Number(isoMatch[1]),
        Number(isoMatch[2]) - 1,
        Number(isoMatch[3]),
      )
    : new Date(value);

  if (Number.isNaN(date.getTime())) return "";

  const formatted = date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
  return ` — ${formatted}`;
}
