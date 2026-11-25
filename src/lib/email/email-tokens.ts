import { formatHumanDate } from "@/lib/field-format";
import { projectDisplayName, serviceNoun } from "@/lib/project-name";
import type { ClientRecordFull } from "@/lib/clients";

// The {{token}} values a pipeline template fills from a project. The compose
// panel and the AI drafter both use these, so a link in a draft is the same
// real URL the template would have had.
export function emailTokens(
  record: ClientRecordFull,
  origin: string,
): Record<string, string | undefined> {
  return {
    firstName: record.clientName?.trim().split(/\s+/)[0],
    clientName: record.clientName,
    projectName: projectDisplayName(record),
    serviceNoun: serviceNoun(record.serviceType)?.toLowerCase(),
    eventDate: formatHumanDate(record.eventDate) || undefined,
    venue: record.locations?.[0]?.label || record.locations?.[0]?.address,
    galleryUrl: record.galleryUrl,
    portalUrl: `${origin}/portal`,
    bookingUrl: `${origin}/book`,
    questionnaireUrl: record.serviceType
      ? `${origin}/questionnaire/${record.serviceType}`
      : undefined,
  };
}
