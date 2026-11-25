import { getQuestionnaire } from "@/lib/questionnaires";
import { documentType } from "@/lib/labels";
import type { ClientDocumentEntry, ClientRecordSafe } from "@/lib/clients";

// The one builder for every link that belongs to a project: the portal page,
// the prefilled questionnaire or inquiry, and the typed links Julian adds
// (proposal, contract, invoice, highlights, gallery). The admin page, the
// portal page and the email tokens all read from here, so a link is built the
// same way wherever it shows up.

// The link of one kind to hand a client: the newest entry of that kind. For
// invoices, the newest one that isn't paid yet. A kind only Julian adds never
// resolves to something a client uploaded under that name.
export function projectLink(
  record: { documents?: ClientDocumentEntry[] },
  type: string,
): ClientDocumentEntry | undefined {
  const ownerOnly = documentType(type)?.addedBy === "owner";
  return (record.documents ?? [])
    .filter(
      (d) =>
        d.type === type &&
        !(ownerOnly && d.uploadedBy === "client") &&
        (type !== "invoice" || !d.paidAt),
    )
    .at(-1);
}

export type ProjectLinks = {
  portalUrl: string;
  // Set when the service has a planning questionnaire. Prefilled with what's
  // known about the client, so it carries their name, email and phone.
  questionnaireUrl?: string;
  // The same form, attached to the project but without those details in the
  // address: for anything that leaves the site other than to the client (the
  // AI drafter's prompt).
  questionnaireBareUrl?: string;
  // Set while the project has no service yet: the inquiry sets it on submit.
  inquireUrl?: string;
  proposalUrl?: string;
  contractUrl?: string;
  invoiceUrl?: string;
  highlightsUrl?: string;
  galleryUrl?: string;
};

// `origin` is the site's address for links that leave the app (emails, a link
// Julian copies); pass "" for links followed inside it.
export function projectLinks(record: ClientRecordSafe, origin: string): ProjectLinks {
  // The form attaches its submission to THIS project (not a fresh email and
  // service match) and opens with what's already known filled in.
  const known = new URLSearchParams({ project: record.id });
  if (record.clientName) known.set("fullName", record.clientName);
  if (record.email) known.set("email", record.email);
  if (record.phone) known.set("phone", record.phone);

  let questionnaireUrl: string | undefined;
  let questionnaireBareUrl: string | undefined;
  if (record.serviceType && getQuestionnaire(record.serviceType)) {
    const form = `${origin}/questionnaire/${record.serviceType}`;
    const q = new URLSearchParams(known);
    if (record.partnerName) q.set("partnerFullName", record.partnerName);
    if (record.eventDate) q.set("eventDate", record.eventDate);
    if (record.guestCount != null) q.set("guestCount", String(record.guestCount));
    questionnaireUrl = `${form}?${q.toString()}`;
    questionnaireBareUrl = `${form}?${new URLSearchParams({ project: record.id }).toString()}`;
  }

  return {
    portalUrl: `${origin}/portal/projects/${record.id}`,
    questionnaireUrl,
    questionnaireBareUrl,
    inquireUrl: record.serviceType
      ? undefined
      : `${origin}/inquire?${known.toString()}`,
    proposalUrl: projectLink(record, "proposal")?.url,
    contractUrl: projectLink(record, "contract")?.url,
    invoiceUrl: projectLink(record, "invoice")?.url,
    highlightsUrl: projectLink(record, "highlights")?.url,
    galleryUrl: projectLink(record, "gallery")?.url,
  };
}
