import { eventMonthYear, formatEventDate, formatHumanDate, studioToday } from "@/lib/field-format";
import { projectDisplayName, serviceNoun } from "@/lib/project-name";
import { openInvoice, planningCallFor, projectLinks } from "@/lib/project-links";
import { formKey } from "@/lib/form-key";
import { paymentMethodLabel, type PaymentMethod } from "@/lib/labels";
import { getAnyService, getSiteSettings, getVisiblePortfolios } from "@/lib/content";
import { questionnaireOutstanding } from "@/lib/next-step";
import { sampleGalleryFor } from "@/lib/services-data";
import { heldUntil } from "@/lib/email/send-effects";
import type { ClientRecordFull } from "@/lib/clients";
import type { EmailToken } from "@/lib/email/email-pipeline";

// The {{token}} values a pipeline template fills from a project. The compose
// panel and the AI drafter both use these, so a link in a draft is the same
// real URL the template would have had. Every project link comes from
// projectLinks(); booking terms come from the service (Studio) and site
// settings.
export async function emailTokens(
  record: ClientRecordFull,
  origin: string,
): Promise<Record<EmailToken, string | undefined>> {
  const [settings, service, portfolios] = await Promise.all([
    getSiteSettings(),
    record.serviceType ? getAnyService(record.serviceType) : undefined,
    getVisiblePortfolios(),
  ]);
  const today = studioToday();
  const links = projectLinks(record, origin, { formKey: formKey(record.id) });
  const invoice = openInvoice(record, today);
  const pkg = service?.packages.find((p) => p.name === record.package);
  // Only a hold that's running: the one a template would start depends on the
  // template (holdUntilFor in send-effects.ts), so Compose and the drafter add it.
  const hold = heldUntil(record, undefined, today);
  return {
    firstName: record.clientName?.trim().split(/\s+/)[0],
    clientName: record.clientName,
    projectName: projectDisplayName(record),
    serviceNoun: serviceNoun(record.serviceType)?.toLowerCase(),
    // A day is written out and text naming a year ("Fall 2027") shows as
    // typed; text naming no year ("TBD") leaves the [eventDate] marker to fill.
    eventDate: eventMonthYear(record.eventDate) ? formatEventDate(record.eventDate) : undefined,
    venue: record.locations?.[0]?.label || record.locations?.[0]?.address,
    portalUrl: links.portalUrl,
    questionnaireUrl: links.questionnaireUrl,
    bookingUrl: `${origin}/book`,
    discoveryCallUrl: settings.calls.discoveryCall.url,
    reviewUrl: settings.googleProfileUrl,
    proposalUrl: links.proposalUrl,
    contractUrl: links.contractUrl,
    invoiceUrl: links.invoiceUrl,
    invoiceDueDate: formatHumanDate(invoice?.dueAt) || undefined,
    highlightsUrl: links.highlightsUrl,
    galleryUrl: links.galleryUrl,
    timelineUrl: links.timelineUrl,
    // The collection on the project, as the service offers it.
    packageName: pkg?.name ?? record.package,
    // With its note when it has one ("$125, per person · minimum 5 people"),
    // so a per-person or base price doesn't read as the total.
    packagePrice: pkg
      ? [pkg.price, pkg.priceNote && pkg.priceNote[0].toLowerCase() + pkg.priceNote.slice(1)]
          .filter(Boolean)
          .join(", ")
      : undefined,
    packageInclusions: pkg?.inclusions.map((i) => `- ${i}`).join("\n"),
    // Booking terms: a gallery of the work (Studio's sample gallery, else the
    // service's portfolio page), the retainer, and the date hold that's running.
    sampleGalleryUrl: sampleGalleryFor(service, portfolios),
    retainerPercent:
      service?.retainerPercent != null ? String(service.retainerPercent) : undefined,
    holdUntil: hold ? formatHumanDate(hold.until) : undefined,
    // How this client is paying, and the how-to-pay line for that method
    // while an invoice of Julian's is open (an optional line otherwise left out).
    paymentMethod: paymentMethodLabel(record.paymentMethod) || undefined,
    paymentInstructions:
      invoice && record.paymentMethod
        ? settings.paymentInstructions[record.paymentMethod as PaymentMethod]
        : undefined,
    // Every client email before the shoot asks for the questionnaire while it
    // isn't back (an optional line, left out once it is).
    questionnaireNudge:
      links.questionnaireUrl &&
      questionnaireOutstanding(record, { today, hasQuestionnaire: true })
        ? `When you have a few minutes, the planning questionnaire helps me prepare, and it's already filled in with what I have: ${links.questionnaireUrl}`
        : undefined,
    // The call that plans the shoot: the timeline call for a wedding or its
    // film, the planning call otherwise.
    planningCallUrl: planningCallFor(record.serviceType, settings.calls).url || undefined,
  };
}
