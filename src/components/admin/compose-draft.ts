// The email being written in a project's Compose panel and not sent yet, kept
// while the page stays loaded (moving between the project page's tabs and
// the site's other pages; a reload starts afresh): one per project, with the
// hand-off it was opened on (the template and link in the address).
// Switching tabs on the project page unmounts the panel; the Messages tab, or
// the same hand-off again (by a link or the back button), shows the email as
// it was left. A hand-off to something else opens afresh.

export type ComposeDraftState = {
  templateId: string;
  subject: string;
  body: string;
  instructions: string;
  // The send's idempotency key for this text, so a send retried after the
  // panel was reopened (its first reply lost, or still on the way) goes once.
  sendKey: string;
};

// The Messages tab's own address names no hand-off.
export const NO_HANDOFF = "|";

const drafts = new Map<string, { handoff: string; draft: ComposeDraftState }>();

export const composeDraft = {
  // The kept email to show for this opening of the panel, and the hand-off to
  // keep it under.
  resume(projectId: string, handoff: string): { handoff: string; draft?: ComposeDraftState } {
    const kept = drafts.get(projectId);
    if (!kept) return { handoff };
    // The same hand-off, the tab's own address, or a hand-off to the template
    // the email was started on there.
    const sameTemplate = kept.handoff === NO_HANDOFF && handoff === `${kept.draft.templateId}|`;
    if (kept.handoff === handoff || handoff === NO_HANDOFF || sameTemplate) return kept;
    return { handoff };
  },
  // The kept email, whatever it was opened on.
  peek: (projectId: string) => drafts.get(projectId),
  set: (projectId: string, handoff: string, draft: ComposeDraftState) =>
    void drafts.set(projectId, { handoff, draft }),
  // Once it has been sent, the panel opens afresh.
  clear: (projectId: string) => void drafts.delete(projectId),
  // A kept email on a template the project has changed under (the recap,
  // after the call summary is edited) opens afresh from the new facts.
  dropTemplate(projectId: string, template: string) {
    if (drafts.get(projectId)?.draft.templateId === template) drafts.delete(projectId);
  },
};
