import { CLIENT_STATUS_OPTIONS } from "./client-status";

// Display labels for client-record fields (source, status, document type,
// uploader), so a stored slug never reaches the screen. Service titles,
// referral labels, and dates live in their own modules.

// Title-case an unknown slug ("some-new-value" → "Some New Value") so a value
// added to the data layer before its label still reads like words.
export function titleCaseSlug(slug: string): string {
  return slug
    .split("-")
    .map((w) => (w ? w.charAt(0).toUpperCase() + w.slice(1) : w))
    .join(" ");
}

// ── Status (admin-facing pipeline titles) ──

// The owner-facing status titles, keyed by status value.
export const STATUS_TITLE: Record<string, string> = Object.fromEntries(
  CLIENT_STATUS_OPTIONS.map((o) => [o.value, o.title]),
);

export function statusTitle(status?: string): string {
  if (!status) return "";
  return STATUS_TITLE[status] ?? titleCaseSlug(status);
}

// ── Source (how a project entered the pipeline) ──

const SOURCE_LABEL: Record<string, string> = {
  "inquiry-form": "Inquiry form",
  questionnaire: "Questionnaire",
  "manual-admin": "Added manually",
  "manual-client": "Started in the portal",
};

export function sourceLabel(source?: string): string {
  if (!source) return "";
  return SOURCE_LABEL[source] ?? titleCaseSlug(source);
}

// ── Documents ──

// The client-uploadable document kinds, shown in the portal upload picker.
export const DOCUMENT_TYPE_OPTIONS: { value: string; label: string }[] = [
  { value: "other", label: "General" },
  { value: "contract", label: "Contract" },
  { value: "invoice", label: "Invoice" },
  { value: "timeline", label: "Timeline" },
  { value: "moodboard", label: "Moodboard" },
];

// System-generated kinds that never appear in the upload picker but still
// need a friendly name when listed.
const DOCUMENT_TYPE_EXTRA: Record<string, string> = {
  "questionnaire-pdf": "Questionnaire PDF",
};

export function documentTypeLabel(type?: string): string {
  if (!type) return "";
  return (
    DOCUMENT_TYPE_OPTIONS.find((o) => o.value === type)?.label ??
    DOCUMENT_TYPE_EXTRA[type] ??
    titleCaseSlug(type)
  );
}

export function uploaderLabel(uploadedBy?: string): string {
  if (uploadedBy === "julian") return "Julian";
  if (uploadedBy === "client") return "Client";
  return uploadedBy ? titleCaseSlug(uploadedBy) : "";
}
