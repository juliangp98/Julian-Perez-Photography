// Transactional notification senders (server-only). Each renders the shared
// branded layout and sends via Resend; all are fire-and-forget and no-op when
// Resend isn't configured, so a missing key never breaks the primary request.

import { Resend } from "resend";
import { render } from "@react-email/components";
import {
  BrandedEmailLayout,
  NotificationEmailTemplate,
} from "./email-templates";
import {
  CLIENT_STATUS_CLIENT_LABEL,
  type ClientStatus,
} from "./client-status";

function resendFrom(): string {
  return (
    process.env.RESEND_FROM ||
    "Julian Perez Photography <onboarding@resend.dev>"
  );
}

// Notify a client that their project was updated. `lines` is the prose body;
// `changes` (optional) renders as a compact bulleted list of what actually
// changed. The email always carries a "sign in to your portal" call to action.
export async function sendClientUpdateEmail(opts: {
  to?: string;
  firstName?: string;
  projectName: string;
  portalUrl: string;
  lines: string[];
  changes?: string[];
}): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey || !opts.to) return;

  const heading = opts.firstName
    ? `Hi ${opts.firstName},`
    : "An update on your project";
  const html = await render(
    BrandedEmailLayout({
      preview: `An update on ${opts.projectName}`,
      children: NotificationEmailTemplate({
        heading,
        lines: opts.lines,
        changes: opts.changes,
        cta: { label: "Open your portal →", href: opts.portalUrl },
      }),
    }),
  );

  const changeText =
    opts.changes && opts.changes.length
      ? `\n\n${opts.changes.map((c) => `• ${c}`).join("\n")}`
      : "";
  await new Resend(apiKey).emails.send({
    from: resendFrom(),
    to: opts.to,
    subject: `An update on ${opts.projectName}`,
    html,
    text: `${opts.lines.join("\n\n")}${changeText}\n\nOpen your portal: ${opts.portalUrl}`,
  });
}

// ---------------------------------------------------------------------------
// Change summary — turn a before/after field diff into client-facing lines.
// ---------------------------------------------------------------------------

// Fields whose changes are meaningful (and safe) to surface to a client. The
// internal note, budget, and raw service slug are deliberately excluded — they
// are either private or not the client's concern.
type ChangeableFields = {
  status?: string;
  eventDate?: string;
  package?: string;
  guestCount?: number;
  planSummary?: string;
  galleryUrl?: string;
};

function parseDay(d?: string): Date | null {
  if (!d) return null;
  const s = d.trim();
  if (!s) return null;
  // An ISO calendar date is anchored to local midnight so the day doesn't
  // shift under a negative UTC offset; other formats parse as-is.
  const normalized = /^\d{4}-\d{2}-\d{2}$/.test(s) ? `${s}T00:00:00` : s;
  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? null : date;
}

// "2026-06-07" — for comparing two dates regardless of source format.
function isoDay(d?: string): string {
  const date = parseDay(d);
  if (!date) return (d ?? "").trim();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${mm}-${dd}`;
}

// "June 7, 2026" — for display.
function longDay(d?: string): string {
  const date = parseDay(d);
  if (!date) return (d ?? "").trim();
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

const trimmed = (s?: string) => (s ?? "").trim();

// Compare a pre-update record against the submitted fields and return a list of
// human, client-facing change descriptions (empty when nothing relevant moved).
// Only fields the client both sees and cares about are reported.
export function summarizeClientChanges(
  before: ChangeableFields,
  fields: ChangeableFields,
): string[] {
  const out: string[] = [];

  if (fields.status && fields.status !== before.status) {
    const label = CLIENT_STATUS_CLIENT_LABEL[fields.status as ClientStatus];
    if (label) out.push(`Status: now “${label}”`);
  }

  if (
    fields.eventDate !== undefined &&
    isoDay(fields.eventDate) !== isoDay(before.eventDate)
  ) {
    const d = longDay(fields.eventDate);
    out.push(d ? `Event date: ${d}` : "Event date: cleared");
  }

  if (
    fields.package !== undefined &&
    trimmed(fields.package) !== trimmed(before.package)
  ) {
    out.push(
      trimmed(fields.package)
        ? `Package: ${trimmed(fields.package)}`
        : "Package: cleared",
    );
  }

  if (fields.guestCount !== undefined && fields.guestCount !== before.guestCount) {
    out.push(`Guest count: ${fields.guestCount}`);
  }

  if (
    fields.planSummary !== undefined &&
    trimmed(fields.planSummary) !== trimmed(before.planSummary)
  ) {
    out.push("Plan details were updated");
  }

  if (
    fields.galleryUrl !== undefined &&
    trimmed(fields.galleryUrl) !== trimmed(before.galleryUrl) &&
    trimmed(fields.galleryUrl)
  ) {
    out.push("Your photo gallery is ready to view");
  }

  return out;
}

// Whether the "a client edited their details" email to Julian is enabled.
// Defaults on; set NOTIFY_CLIENT_EDITS=false to mute it.
export function clientEditNotifyEnabled(): boolean {
  return process.env.NOTIFY_CLIENT_EDITS !== "false";
}
