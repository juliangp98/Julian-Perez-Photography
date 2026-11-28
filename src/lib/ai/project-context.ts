// The one place a project is turned into facts for an AI prompt, in two tiers:
//
// - "client": what may end up in words a client reads (a plan summary, an
//   email draft). Never the budget, the referral, the owner's notes, or the
//   client's email and phone. What the client wrote themselves (the inquiry,
//   their messages, their answers) may be read beside it, without contact
//   details (withoutContacts), by a draft written back to them.
// - "internal": what only Julian reads (an assessment, a shoot brief). Adds
//   the budget, how they found him, where the project came from and its status.
//
// A fact that isn't known is said so ("not provided"), so a model never fills
// the gap itself.

import "server-only";
import { createHash } from "node:crypto";
import type { ClientRecordFull } from "@/lib/clients";
import { isConversation, type ClientMessage } from "@/lib/messages";
import { visibleToClient } from "@/lib/message-visibility";
import { daysUntil, formatEventDate } from "@/lib/field-format";
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
      ? `Event date: ${formatEventDate(record.eventDate)}${when}`
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
// sections, without the client's contact details, or null before one is
// submitted. Both tiers may read it: the client wrote it for Julian to plan
// from. At the client tier, how they found Julian stays out as well.
export function projectAnswers(
  record: ClientRecordFull,
  { tier = "internal" }: { tier?: ContextTier } = {},
): string | null {
  return record.questionnaireSnapshot?.trim()
    ? buildAnswerDigest(record.serviceType, record.questionnaireSnapshot, { forClient: tier === "client" })
    : null;
}

// Facts as a bulleted block for a prompt.
export function factLines(facts: string[]): string {
  return facts.map((f) => `- ${f}`).join("\n");
}

// A short fingerprint of the text an AI result was made from: what the
// assessment read (the inquiry message) or the brief (the questionnaire
// answers). A saved result whose fingerprint no longer matches the project is
// out of date.
export function aiBasis(text: string | undefined): string {
  return createHash("sha256").update((text ?? "").trim()).digest("hex").slice(0, 16);
}

// Whether a saved result was made from what the project holds now. One saved
// without a fingerprint counts as current.
export function isCurrent(
  saved: { basis?: string } | undefined,
  text: string | undefined,
): boolean {
  return !!saved && (!saved.basis || saved.basis === aiBasis(text));
}

// Text a client wrote, with email addresses, links and phone numbers taken out:
// a model never needs them.
export function withoutContacts(text: string): string {
  return text
    .replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, "[email]")
    .replace(/https?:\/\/\S+/g, "[link]")
    .replace(/(\+?1[\s.-]?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}/g, "[phone]");
}

// The conversation with the client (isConversation) that has words in it,
// oldest first. `clientView` keeps only what the client can see of it
// (visibleToClient), for words written back to them: Julian's mail filed
// from Gmail to a venue counts as him writing, but isn't theirs to read.
export function conversation(
  messages: ClientMessage[],
  clientEmail?: string,
  { clientView = false }: { clientView?: boolean } = {},
): ClientMessage[] {
  return messages.filter(
    (m) => isConversation(m, clientEmail) && m.bodyText?.trim() && (!clientView || visibleToClient(m, clientEmail)),
  );
}

// The newest `count` messages of the conversation, oldest first, as
// "Client: …" / "Julian: …" lines without contact details, each cut to
// `each` characters.
export function conversationLines(
  messages: ClientMessage[],
  clientEmail: string | undefined,
  { count = 6, each = 600, clientView = false }: { count?: number; each?: number; clientView?: boolean } = {},
): string {
  const recent = conversation(messages, clientEmail, { clientView }).slice(-count);
  if (!recent.length) return "(No messages yet.)";
  return recent
    .map((m) => `${m.direction === "in" ? "Client" : "Julian"}: ${withoutContacts(m.bodyText ?? "").trim().slice(0, each)}`)
    .join("\n\n");
}

// What the tailored call guide was made from: the inquiry, the newest message
// of the conversation (see isConversation) and the questionnaire. Any of them
// changing makes it out of date.
export function callGuideBasisText(record: ClientRecordFull, messages: ClientMessage[]): string {
  const newest = messages.filter((m) => isConversation(m, record.email)).at(-1)?.id;
  return [record.inquiryMessage ?? "", newest ?? "", record.questionnaireSnapshot ?? ""].join("\u0000");
}
