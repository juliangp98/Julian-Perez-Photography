// The AI tools that work on a project, and the shape of what they save. No
// server imports, so the admin panels can use the types.

import type { InquiryTriage } from "./triage";

// A skimmable shoot-day brief built from the planning questionnaire.
export type ShootBrief = {
  headline: string;
  sections: { heading: string; bullets: string[] }[];
};

// Every kind /api/admin/ai answers. The inquiry assessment and the shoot brief
// are saved on the project; the plan summary goes into the edit form, where
// the owner reviews it before saving.
export const AI_KINDS = ["triage", "shoot-brief", "plan-summary"] as const;
export type AiKind = (typeof AI_KINDS)[number];

export type SavedAiResult<T> = {
  result: T;
  // When it was made (an ISO timestamp).
  at: string;
};

// What a project holds (client_records.ai_results), keyed by kind.
export type AiResults = {
  triage?: SavedAiResult<InquiryTriage>;
  "shoot-brief"?: SavedAiResult<ShootBrief>;
};
export type SavedAiKind = keyof AiResults;
