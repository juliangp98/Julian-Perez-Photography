import { CLIENT_STATUS_OPTIONS, type ClientStatus } from "./client-status";
import { formatHumanDate } from "./field-format";

// Display labels for client-record fields (source, status, link and file
// type, uploader, payment method), so a stored slug never reaches the screen.
// Service titles, referral labels, and dates live in their own modules.

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

// ── Links and files ──

// Every kind of link or file a project can hold, in the order the pickers and
// lists show them. One list drives the labels, who may add each kind, what a
// second photographer sees, and which kinds move the project along when added.
export type DocumentTypeInfo = {
  value: string;
  label: string;
  // "owner": only Julian adds it. "both": a client can upload one too.
  // "system": the site files it (never offered in a picker).
  addedBy: "owner" | "both" | "system";
  // Whether a second photographer with read access sees entries of this kind.
  collaborator: boolean;
  // Adding one moves the project forward to this status (never backward).
  advancesTo?: ClientStatus;
  // The Compose template that tells the client about it, when one carries the
  // link (an id from src/lib/email/email-pipeline.ts).
  template?: string;
};

export const DOCUMENT_TYPES: DocumentTypeInfo[] = [
  { value: "proposal", label: "Proposal", addedBy: "owner", collaborator: false },
  { value: "contract", label: "Contract", addedBy: "owner", collaborator: false },
  { value: "invoice", label: "Invoice", addedBy: "owner", collaborator: false },
  { value: "timeline", label: "Timeline", addedBy: "both", collaborator: true },
  { value: "highlights", label: "Highlights", addedBy: "owner", collaborator: false, advancesTo: "editing" },
  { value: "gallery", label: "Gallery", addedBy: "owner", collaborator: false, advancesTo: "delivered", template: "gallery-delivery" },
  { value: "moodboard", label: "Moodboard", addedBy: "both", collaborator: true },
  { value: "other", label: "General", addedBy: "both", collaborator: true },
  { value: "questionnaire-pdf", label: "Questionnaire PDF", addedBy: "system", collaborator: false },
];

// What Julian can add from the project page, and what a client can upload.
export const OWNER_DOCUMENT_TYPES = DOCUMENT_TYPES.filter((t) => t.addedBy !== "system");
export const CLIENT_DOCUMENT_TYPES = DOCUMENT_TYPES.filter((t) => t.addedBy === "both");

export function documentType(type?: string): DocumentTypeInfo | undefined {
  return DOCUMENT_TYPES.find((t) => t.value === type);
}

export function documentTypeLabel(type?: string): string {
  if (!type) return "";
  return documentType(type)?.label ?? titleCaseSlug(type);
}

// Where an invoice stands, in a few words, for the owner and the client alike.
export function invoiceState(doc: { dueAt?: string; paidAt?: string }): string {
  const paid = formatHumanDate(doc.paidAt);
  if (paid) return `Paid ${paid}`;
  const due = formatHumanDate(doc.dueAt);
  return due ? `Due ${due}` : "Not paid yet";
}

// Files uploaded to a project (by a client from the portal or by Julian from
// the admin) go to Blob storage under this path, and may be these kinds.
export const UPLOAD_PATH = "portal/";
export const UPLOAD_CONTENT_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
  "application/pdf",
];

// Whether an entry's address is such an uploaded file rather than a link to
// somewhere else. Taking the entry off a project leaves the file in storage,
// which the remove prompt says.
export function isUploadedFile(url: string): boolean {
  try {
    const { hostname, pathname } = new URL(url);
    return (
      hostname.endsWith(".public.blob.vercel-storage.com") &&
      pathname.startsWith(`/${UPLOAD_PATH}`)
    );
  } catch {
    return false;
  }
}

export function uploaderLabel(uploadedBy?: string): string {
  if (uploadedBy === "julian") return "Julian";
  if (uploadedBy === "client") return "Client";
  return uploadedBy ? titleCaseSlug(uploadedBy) : "";
}

// ── Payment ──

// How a client will pay, chosen per project. Every booking has a Square
// contract and invoice; this records what the client pays the invoice with.
export const PAYMENT_METHODS = [
  { value: "square", label: "Card through Square" },
  { value: "cash", label: "Cash" },
  { value: "zelle", label: "Zelle" },
  { value: "venmo", label: "Venmo" },
  { value: "apple-pay", label: "Apple Pay" },
] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number]["value"];

export function paymentMethodLabel(method?: string): string {
  if (!method) return "";
  return PAYMENT_METHODS.find((m) => m.value === method)?.label ?? titleCaseSlug(method);
}
