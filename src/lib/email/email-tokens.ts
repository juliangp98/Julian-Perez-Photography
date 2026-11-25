import { eventMonthYear, formatEventDate, formatHumanDate, studioToday } from "@/lib/field-format";
import { projectDisplayName, serviceNoun } from "@/lib/project-name";
import { openInvoice, projectLinks } from "@/lib/project-links";
import { paymentMethodLabel, type PaymentMethod } from "@/lib/labels";
import { getAnyService, getSiteSettings } from "@/lib/content";
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
  const [settings, service] = await Promise.all([
    getSiteSettings(),
    record.serviceType ? getAnyService(record.serviceType) : undefined,
  ]);
  const links = projectLinks(record, origin);
  const pkg = service?.packages.find((p) => p.name === record.package);
  // Only a hold that's running: the one a template would start depends on the
  // template (holdUntilFor in send-effects.ts), so Compose and the drafter add it.
  const hold = heldUntil(record, undefined, studioToday());
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
    invoiceDueDate: formatHumanDate(openInvoice(record)?.dueAt) || undefined,
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
    // Booking terms: the service's sample gallery and retainer, and the date
    // hold that's running.
    sampleGalleryUrl: service?.sampleGalleryUrl,
    retainerPercent:
      service?.retainerPercent != null ? String(service.retainerPercent) : undefined,
    holdUntil: hold ? formatHumanDate(hold.until) : undefined,
    // How this client is paying, and the how-to-pay line for that method.
    paymentMethod: paymentMethodLabel(record.paymentMethod) || undefined,
    paymentInstructions: record.paymentMethod
      ? settings.paymentInstructions[record.paymentMethod as PaymentMethod]
      : undefined,
  };
}
