// What an inquiry assessment looks like and how it reads, shared by the AI call
// (src/lib/ai/assess-inquiry.ts), the owner's inquiry email, and the admin
// triage panel. No server imports, so client components can use it.

export type TriageFit = "good" | "maybe" | "poor";
export type TriageUrgency = "high" | "medium" | "low";

export type InquiryTriage = {
  summary: string;
  fit: TriageFit;
  fitReason: string;
  urgency: TriageUrgency;
  urgencyReason: string;
  keyDetails: string[];
};

export const TRIAGE_FIT_LABEL: Record<TriageFit, string> = {
  good: "Good fit",
  maybe: "Possible fit",
  poor: "Likely not a fit",
};

export const TRIAGE_URGENCY_LABEL: Record<TriageUrgency, string> = {
  high: "High urgency",
  medium: "Medium urgency",
  low: "Low urgency",
};

// "Good fit, high urgency": the verdict on one line.
export function triageVerdict(t: Pick<InquiryTriage, "fit" | "urgency">): string {
  return `${TRIAGE_FIT_LABEL[t.fit]}, ${TRIAGE_URGENCY_LABEL[t.urgency].toLowerCase()}`;
}

// The project page with Compose open on the inquiry-reply template. The page
// steers the draft with the assessment saved on the project (triageSteer), so
// no client detail rides in the address. Triage writes no reply itself; the
// compose panel is the one place client email is drafted. `projectPath` is ""
// for a link on the project page itself, or an absolute project URL for an
// email. `version` (the assessment's timestamp) makes a link after a new
// assessment a new address, so Compose opens afresh with the new steer.
export function draftReplyHref(projectPath = "", version?: string): string {
  const v = version ? `&v=${encodeURIComponent(version)}` : "";
  return `${projectPath}?compose=inquiry-reply${v}#compose`;
}

// The steer an assessment gives the AI draft of the reply.
export function triageSteer(triage: InquiryTriage): string {
  return [triage.summary, ...triage.keyDetails].join(" ").slice(0, 600);
}
