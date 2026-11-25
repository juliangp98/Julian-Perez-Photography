import { formatHumanDate } from "@/lib/field-format";
import { projectDisplayName, serviceNoun } from "@/lib/project-name";
import { projectLinks } from "@/lib/project-links";
import { paymentMethodLabel, type PaymentMethod } from "@/lib/labels";
import { getSiteSettings } from "@/lib/content";
import type { ClientRecordFull } from "@/lib/clients";

// The {{token}} values a pipeline template fills from a project. The compose
// panel and the AI drafter both use these, so a link in a draft is the same
// real URL the template would have had. Every link comes from projectLinks().
export async function emailTokens(
  record: ClientRecordFull,
  origin: string,
): Promise<Record<string, string | undefined>> {
  const settings = await getSiteSettings();
  const links = projectLinks(record, origin);
  return {
    firstName: record.clientName?.trim().split(/\s+/)[0],
    clientName: record.clientName,
    projectName: projectDisplayName(record),
    serviceNoun: serviceNoun(record.serviceType)?.toLowerCase(),
    eventDate: formatHumanDate(record.eventDate) || undefined,
    venue: record.locations?.[0]?.label || record.locations?.[0]?.address,
    portalUrl: links.portalUrl,
    questionnaireUrl: links.questionnaireUrl,
    bookingUrl: `${origin}/book`,
    proposalUrl: links.proposalUrl,
    contractUrl: links.contractUrl,
    invoiceUrl: links.invoiceUrl,
    highlightsUrl: links.highlightsUrl,
    galleryUrl: links.galleryUrl,
    // How this client is paying, and the how-to line for that method.
    paymentMethod: paymentMethodLabel(record.paymentMethod) || undefined,
    paymentInstructions: record.paymentMethod
      ? settings.paymentInstructions[record.paymentMethod as PaymentMethod]
      : undefined,
  };
}
