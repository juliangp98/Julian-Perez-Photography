// The email being written in a project's Compose panel and not sent yet, kept
// for as long as the browser tab is open: one per project, with the hand-off
// it was opened on (the template, link and assessment in the address).
// Switching tabs on the project page unmounts the panel; the Messages tab, or
// the same hand-off again (by a link or the back button), shows the email as
// it was left. A hand-off to something else opens afresh.

export type ComposeDraftState = {
  templateId: string;
  subject: string;
  body: string;
  instructions: string;
};

// The Messages tab's own address names no hand-off.
export const NO_HANDOFF = "||";

const drafts = new Map<string, { handoff: string; draft: ComposeDraftState }>();

export const composeDraft = {
  // The kept email to show for this opening of the panel, and the hand-off to
  // keep it under.
  resume(projectId: string, handoff: string): { handoff: string; draft?: ComposeDraftState } {
    const kept = drafts.get(projectId);
    if (kept && (kept.handoff === handoff || handoff === NO_HANDOFF)) return kept;
    return { handoff };
  },
  set: (projectId: string, handoff: string, draft: ComposeDraftState) =>
    void drafts.set(projectId, { handoff, draft }),
  // Once it has been sent, the panel opens afresh.
  clear: (projectId: string) => void drafts.delete(projectId),
};
