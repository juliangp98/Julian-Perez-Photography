import { getQuestionnaire } from "@/lib/questionnaires";
import { documentType } from "@/lib/labels";
import { studioToday } from "@/lib/field-format";
import type { ClientDocumentEntry, ClientRecordSafe } from "@/lib/clients";

// The one builder for every link that belongs to a project: the portal page,
// the prefilled questionnaire or inquiry, and the typed links Julian adds
// (proposal, contract, invoice, highlights, gallery). The admin page, the
// portal page and the email tokens all read from here, so a link is built the
// same way wherever it shows up.

// The link of one kind to hand a client: the newest entry of that kind. For
// invoices, the newest one that isn't paid yet. A kind only Julian adds never
// resolves to something a client uploaded under that name; `fromOwner` asks
// for Julian's own entry of a kind both may add (the timeline he sends).
export function projectLink(
  record: { documents?: ClientDocumentEntry[] },
  type: string,
  { fromOwner = false }: { fromOwner?: boolean } = {},
): ClientDocumentEntry | undefined {
  const ownerOnly = fromOwner || documentType(type)?.addedBy === "owner";
  return (record.documents ?? [])
    .filter(
      (d) =>
        d.type === type &&
        !(ownerOnly && d.uploadedBy === "client") &&
        (type !== "invoice" || !d.paidAt),
    )
    .at(-1);
}

// The invoice a client is asked to pay next, of Julian's unpaid invoices: the
// one overdue longest, else the first added with no due day (due on receipt,
// like a retainer), else the one due first. Both next steps (the client's
// retainer too), the portal and the email tokens read the same one, so the
// contract email, a reminder and the portal name the invoice the step said
// was due. `today` is the studio's calendar day.
export function openInvoice<D extends { type?: string; uploadedBy?: string; dueAt?: string; paidAt?: string }>(
  record: { documents?: D[] },
  today: string,
): D | undefined {
  const unpaid = (record.documents ?? []).filter(
    (d) => d.type === "invoice" && d.uploadedBy !== "client" && !d.paidAt,
  );
  const isDay = (d: D) => /^\d{4}-\d{2}-\d{2}$/.test(d.dueAt ?? "");
  const dated = unpaid.filter(isDay).sort((a, b) => (a.dueAt ?? "").localeCompare(b.dueAt ?? ""));
  const overdue = dated.find((d) => (d.dueAt ?? "") < today);
  return overdue ?? unpaid.find((d) => !isDay(d)) ?? dated[0];
}

// The call that plans the shoot once the questionnaire is in: the wedding
// timeline call for a wedding or its film, the planning call for every other
// service. The client's next step offers this one, and the questionnaire's
// thank-you page offers it first.
const TIMELINE_CALL_SERVICES = new Set(["weddings", "wedding-films"]);

export function planningCallFor<C extends { label: string; url: string }>(
  service: string | undefined,
  calls: { planningCall: C; weddingTimelineCall: C },
): C & { kind: "timeline" | "planning" } {
  return TIMELINE_CALL_SERVICES.has(service ?? "")
    ? { ...calls.weddingTimelineCall, kind: "timeline" }
    : { ...calls.planningCall, kind: "planning" };
}

// The calls the questionnaire's thank-you page offers, in order: the one
// above first, then for a wedding or its film the general planning call, and
// for a wedding the venue walkthrough.
export function thankYouCalls<C extends { label: string; url: string }>(
  service: string | undefined,
  calls: { planningCall: C; weddingTimelineCall: C; venueWalkthrough: C },
): C[] {
  const first = planningCallFor(service, calls);
  if (first.kind === "planning") return [calls.planningCall];
  return service === "weddings"
    ? [calls.weddingTimelineCall, calls.planningCall, calls.venueWalkthrough]
    : [calls.weddingTimelineCall, calls.planningCall];
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
  timelineUrl?: string;
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
    invoiceUrl: openInvoice(record, studioToday())?.url,
    highlightsUrl: projectLink(record, "highlights")?.url,
    galleryUrl: projectLink(record, "gallery")?.url,
    timelineUrl: projectLink(record, "timeline", { fromOwner: true })?.url,
  };
}
