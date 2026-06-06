// Cross-prefill helpers for the curated service bundles. When a client finishes
// one planning questionnaire, the success screen offers to continue into its
// bundle siblings and carries over every answer the sibling form also asks for
// (matched by field id), so harmonized fields are never re-typed.
//
// The bundle groups themselves live in `questionnaires.ts` (so the same data
// drives both the in-form "related sessions" prompt and this cross-prefill
// offer); they're re-exported here for the form component's existing imports.

import { getQuestionnaire } from "./questionnaires";

export { QUESTIONNAIRE_BUNDLES, bundleSiblings } from "./questionnaires";

// The field IDs of a questionnaire that can round-trip through a URL — every
// field except file uploads (which can't be prefilled from a query string) and
// the generated `bundleInterest` prompt (its options are the OTHER services in
// the bundle, so carrying a selection across siblings would be meaningless).
// Cross-prefill carries the intersection of the source's answers and this set.
export function prefillableFieldIds(slug: string): Set<string> {
  const ids = new Set<string>();
  const q = getQuestionnaire(slug);
  if (!q) return ids;
  for (const section of q.sections) {
    for (const field of section.fields) {
      if (field.type !== "file" && field.id !== "bundleInterest") {
        ids.add(field.id);
      }
    }
  }
  return ids;
}
