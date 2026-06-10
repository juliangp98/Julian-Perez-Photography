// Formatting + validation helpers for the form-field primitives in
// `src/components/ui/fields`, plus the site's one human-readable date formatter
// (`formatHumanDate`, used in UI + emails). Pure functions, no React — easy to
// unit-test and reuse on the client or the server. The phone display mask is the
// visual companion to `normalizeE164` (`src/lib/sms.ts`), which owns server-side
// E.164 normalization for Twilio; this only shapes what the user sees.

// ── Phone ──

// Progressive US/DMV display mask: digits → "(703) 555-1234". Formats partial
// input live and ignores anything past 10 digits. A leading US country code
// "1" is dropped so "+1 703…" and "1703…" both land correctly.
export function formatPhone(raw: string): string {
  let digits = raw.replace(/\D/g, "");
  if (digits.length === 11 && digits.startsWith("1")) digits = digits.slice(1);
  digits = digits.slice(0, 10);
  const len = digits.length;
  if (len === 0) return "";
  if (len < 4) return `(${digits}`;
  if (len < 7) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}

// A phone is "complete enough" when it has exactly 10 digits (or 11 with a
// leading 1) — used to flag a too-short number on blur.
export function isCompletePhone(raw: string): boolean {
  const digits = raw.replace(/\D/g, "");
  return digits.length === 10 || (digits.length === 11 && digits.startsWith("1"));
}

// ── Email ──

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export function isValidEmail(email: string): boolean {
  return EMAIL_RE.test(email.trim());
}

// Common provider domain + TLD typos → the intended value. Returns a corrected
// full email when the domain looks like a near-miss of a popular provider, else
// null. Lightweight — no network / MX lookup.
const DOMAIN_FIXES: Record<string, string> = {
  "gmail.con": "gmail.com",
  "gmail.co": "gmail.com",
  "gmail.cm": "gmail.com",
  "gmai.com": "gmail.com",
  "gmial.com": "gmail.com",
  "gmal.com": "gmail.com",
  "gnail.com": "gmail.com",
  "gmaill.com": "gmail.com",
  "yahoo.con": "yahoo.com",
  "yaho.com": "yahoo.com",
  "yahooo.com": "yahoo.com",
  "yhaoo.com": "yahoo.com",
  "hotmail.con": "hotmail.com",
  "hotmial.com": "hotmail.com",
  "hotmail.co": "hotmail.com",
  "hotmil.com": "hotmail.com",
  "outlook.con": "outlook.com",
  "outlok.com": "outlook.com",
  "icloud.con": "icloud.com",
  "iclould.com": "icloud.com",
  "icloud.co": "icloud.com",
  "aol.con": "aol.com",
};

export function suggestEmailFix(email: string): string | null {
  const trimmed = email.trim();
  const at = trimmed.lastIndexOf("@");
  if (at < 1) return null;
  const local = trimmed.slice(0, at);
  const domain = trimmed.slice(at + 1).toLowerCase();
  if (!domain) return null;
  const fixed = DOMAIN_FIXES[domain];
  if (fixed && fixed !== domain) return `${local}@${fixed}`;
  // Generic ".con" → ".com" TLD slip not covered by the table above.
  if (domain.endsWith(".con")) return `${local}@${domain.slice(0, -4)}.com`;
  return null;
}

// ── Budget ──

// Prepend "$" if missing (used on each keystroke so the sign appears as you
// type) — cursor-safe because it only ever inserts at the start.
export function withDollar(raw: string): string {
  const v = raw.trim();
  if (!v) return "";
  return v.startsWith("$") ? v : `$${v}`;
}

// Full pass for blur: leading "$" plus thousands commas on a plain number,
// while a range ("$2,500 – $3,500") is left as typed (just the "$").
export function formatBudget(raw: string): string {
  let v = raw.trim().replace(/^\$\s*/, "");
  if (!v) return "";
  const isRange = /[-–—]|\bto\b/i.test(v);
  if (!isRange && /^\d[\d,]*$/.test(v)) {
    v = Number(v.replace(/,/g, "")).toLocaleString("en-US");
  }
  return `$${v}`;
}

// ── Date ──

// Mask a typed date to MM/DD/YYYY as digits arrive (auto-insert slashes,
// auto-advance month→day→year). Caps at 8 digits.
export function maskDate(raw: string): string {
  const d = raw.replace(/\D/g, "").slice(0, 8);
  if (d.length < 3) return d;
  if (d.length < 5) return `${d.slice(0, 2)}/${d.slice(2)}`;
  return `${d.slice(0, 2)}/${d.slice(2, 4)}/${d.slice(4)}`;
}

// MM/DD/YYYY (display) → ISO yyyy-MM-dd, or "" when incomplete/impossible.
export function displayToIso(display: string): string {
  const m = display.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return "";
  const [, mm, dd, yyyy] = m;
  const month = Number(mm);
  const day = Number(dd);
  const year = Number(yyyy);
  if (month < 1 || month > 12 || day < 1 || day > 31) return "";
  const dt = new Date(year, month - 1, day);
  // Reject impossible dates (02/31 etc.) — the Date constructor rolls them over.
  if (dt.getMonth() !== month - 1 || dt.getDate() !== day) return "";
  return `${yyyy}-${mm}-${dd}`;
}

// ISO yyyy-MM-dd → MM/DD/YYYY display, or "" .
export function isoToDisplay(iso: string): string {
  const m = (iso || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return "";
  const [, yyyy, mm, dd] = m;
  return `${mm}/${dd}/${yyyy}`;
}

// The studio's home timezone. Server renders run in UTC on Vercel, so a full
// timestamp formatted without a pinned zone can show the wrong calendar day
// (a 9 PM Eastern record reads as tomorrow) — pass this wherever a stored
// timestamp (not a plain calendar date) is displayed.
export const STUDIO_TIME_ZONE = "America/New_York";

// Human-readable date for UI + emails: "June 7, 2026" (or "Jun 7, 2026" with
// `month: "short"`). Accepts an ISO calendar date (anchored to local midnight so
// it never shifts a day in a negative-offset locale) or any Date-parseable
// string/Date; returns "" for empty or unparseable input so callers fall back
// cleanly. Pass `timeZone` (e.g. STUDIO_TIME_ZONE) when the input is a full
// timestamp rather than a calendar date. The site's single source for
// displaying a date.
export function formatHumanDate(
  input?: string | Date | null,
  opts: { month?: "long" | "short"; timeZone?: string } = {},
): string {
  if (!input) return "";
  let date: Date;
  if (input instanceof Date) {
    date = input;
  } else {
    const s = input.trim();
    if (!s) return "";
    const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    date = iso
      ? new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]))
      : new Date(s);
  }
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: opts.month ?? "long",
    day: "numeric",
    ...(opts.timeZone ? { timeZone: opts.timeZone } : {}),
  });
}

// Coarse "how long ago" for a stored timestamp: "today", "yesterday",
// "3 days ago", then weeks / months / years as the gap grows. Returns "" for
// empty, unparseable, or future input so callers can simply append it.
export function formatRelativeDays(iso?: string | null): string {
  if (!iso) return "";
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return "";
  const days = Math.floor((Date.now() - t) / 86_400_000);
  if (days < 0) return "";
  if (days === 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 14) return `${days} days ago`;
  if (days < 60) return `${Math.floor(days / 7)} weeks ago`;
  if (days < 365 * 2) {
    const months = Math.floor(days / 30);
    return months === 1 ? "1 month ago" : `${months} months ago`;
  }
  return `${Math.floor(days / 365)} years ago`;
}
