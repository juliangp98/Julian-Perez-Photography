// The AI tools that work on a project, and the shape of what they save. No
// server imports, so the admin panels can use the types.

import type { InquiryTriage } from "./triage";
import type { CallSummary } from "./calls";

// A skimmable shoot-day brief built from the planning questionnaire.
export type ShootBrief = {
  headline: string;
  sections: { heading: string; bullets: string[] }[];
};

// The discovery-call guide fitted to one client: what to know going in, how
// to position, questions of their own, a note not to read aloud, and one
// opening line for each section of the guide (by section id).
export type CallGuideTailoring = {
  glance: string;
  angle: string;
  questions: string[];
  internal: string;
  openers: Record<string, string>;
};

// What the call summary suggests changing on the project. Applied only when
// the owner accepts each one.
export type CallUpdates = {
  guestCount?: number;
  eventDate?: string;
  venue?: string;
  package?: string;
};

// Every kind /api/admin/ai answers. The inquiry assessment, the shoot brief
// and the tailored call guide are saved on the project; the plan summary goes
// into the edit form and the call summary into the call panel, where the
// owner reviews them before saving.
export const AI_KINDS = [
  "triage",
  "shoot-brief",
  "plan-summary",
  "call-guide",
  "call-summary",
] as const;
export type AiKind = (typeof AI_KINDS)[number];

export type SavedAiResult<T> = {
  result: T;
  // When it was made (an ISO timestamp).
  at: string;
  // A fingerprint of what it was made from (the inquiry message, the
  // questionnaire answers), so the page can tell when that has changed since.
  basis?: string;
};

// What a project holds (client_records.ai_results), keyed by kind.
export type AiResults = {
  triage?: SavedAiResult<InquiryTriage>;
  "shoot-brief"?: SavedAiResult<ShootBrief>;
  "call-guide"?: SavedAiResult<CallGuideTailoring>;
};

// A call summary as the AI drafts it, for the owner to edit.
export type DraftedCallSummary = { summary: CallSummary; updates: CallUpdates };
export type SavedAiKind = keyof AiResults;
