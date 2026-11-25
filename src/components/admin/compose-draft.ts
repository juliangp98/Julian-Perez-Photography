// What's typed in the Compose panel and not sent yet, kept for as long as the
// browser tab is open, by project and hand-off (the template, link and
// assessment it opened on). Switching tabs on the project page, or a hand-off
// that opens Compose afresh, unmounts the panel; coming back to the same
// address (by a tab, a link or the back button) shows the email as it was left.

export type ComposeDraftState = {
  templateId: string;
  subject: string;
  body: string;
  instructions: string;
};

const drafts = new Map<string, ComposeDraftState>();

export const composeDraft = {
  get: (key: string): ComposeDraftState | undefined => drafts.get(key),
  set: (key: string, draft: ComposeDraftState) => void drafts.set(key, draft),
  // Once it has been sent, the panel opens afresh.
  clear: (key: string) => void drafts.delete(key),
};
