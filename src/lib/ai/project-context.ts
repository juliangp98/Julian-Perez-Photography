// The one place a project is turned into facts for an AI prompt, in two tiers:
//
// - "client": what may end up in words a client reads (a plan summary, an
//   email draft). Never the budget, the referral, the internal note, the
//   inquiry's own wording, or the client's email and phone.
// - "internal": what only Julian reads (an assessment, a shoot brief). Adds
//   the budget, how they found him, where the project came from and its status.
//
// A fact that isn't known is said so ("not provided"), so a model never fills
// the gap itself.

import "server-only";
import type { ClientRecordFull } from "@/lib/clients";
import { daysUntil, formatHumanDate } from "@/lib/field-format";
import { projectDisplayName, serviceNoun } from "@/lib/project-name";
import { formatReferral } from "@/lib/referral";
import { sourceLabel, statusTitle } from "@/lib/labels";
import { CLIENT_STATUS_CLIENT_LABEL, type ClientStatus } from "@/lib/client-status";
import { buildAnswerDigest } from "@/lib/questionnaire-digest";

export type ContextTier = "client" | "internal";

export function projectFacts(
  record: ClientRecordFull,
  tier: ContextTier,
  // The plan summary already written; left out when drafting a new one.
  { withPlan = true }: { withPlan?: boolean } = {},
): string[] {
  const noun = serviceNoun(record.serviceType)?.toLowerCase();
  const days = daysUntil(record.eventDate);
  const when =
    days == null ? "" : days >= 0 ? ` (in ${days} days)` : ` (${Math.abs(days)} days ago)`;
  const venue = record.locations?.[0]?.label || record.locations?.[0]?.address;
  const facts: (string | false | undefined)[] = [
    `Project: ${projectDisplayName(record)}`,
    `Service: ${noun ?? "not specified"}`,
    `Client: ${record.clientName || "not provided"}`,
    record.partnerName && `Partner: ${record.partnerName}`,
    record.eventDate
      ? `Event date: ${formatHumanDate(record.eventDate) || record.eventDate}${when}`
      : "Event date: not provided",
    `Venue / location: ${venue ?? "not provided"}`,
    record.guestCount != null && `Guest count: ${record.guestCount}`,
    record.package && `Package: ${record.package}`,
    tier === "client"
      ? record.status &&
        CLIENT_STATUS_CLIENT_LABEL[record.status as ClientStatus] &&
        `Current stage: ${CLIENT_STATUS_CLIENT_LABEL[record.status as ClientStatus]}`
      : `Status: ${statusTitle(record.status) || "not set"}`,
    withPlan && record.planSummary?.trim() && `Plan summary: ${record.planSummary.trim()}`,
  ];
  if (tier === "internal") {
    facts.push(
      `Budget: ${record.budget || "not provided"}`,
      `How they found Julian: ${record.referral ? formatReferral(record.referral, undefined) : "not provided"}`,
      record.source && `Came in through: ${sourceLabel(record.source)}`,
    );
  }
  return facts.filter((f): f is string => !!f);
}

// The planning questionnaire's answers as "Label: value" lines under their
// sections, or null before one is submitted. Both tiers may read it: the
// client wrote it for Julian to plan from.
export function projectAnswers(record: ClientRecordFull): string | null {
  return record.questionnaireSnapshot?.trim()
    ? buildAnswerDigest(record.serviceType, record.questionnaireSnapshot)
    : null;
}

// Facts as a bulleted block for a prompt.
export function factLines(facts: string[]): string {
  return facts.map((f) => `- ${f}`).join("\n");
}
