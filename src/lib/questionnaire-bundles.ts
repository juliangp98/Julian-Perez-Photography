// Curated service bundles for questionnaire cross-prefill. When a client
// finishes one planning questionnaire, the success screen offers to continue
// into its bundle siblings and carries over every answer the sibling form also
// asks for (matched by field id), so harmonized fields are never re-typed.
//
// Adding a bundle is a one-line edit to QUESTIONNAIRE_BUNDLES. Because the
// carry-over is intersection-based (source answers ∩ target field ids), it needs
// no per-pair field lists — it relies on questionnaires sharing canonical field
// IDs for the same concept (see the harmonized IDs in `questionnaires.ts`).

import { getQuestionnaire } from "./questionnaires";

// Groups of service slugs a single client commonly books together. Cross-prefill
// is offered between any two members of the same group.
export const QUESTIONNAIRE_BUNDLES: string[][] = [
  // A couple's wedding coverage.
  ["weddings", "wedding-films", "engagements-couples"],
  // A growing family across the first year(s).
  ["maternity", "newborn", "family-portraits", "family-celebrations"],
];

// Other slugs that share a bundle with `slug` and have a questionnaire of their
// own — the cross-prefill targets offered on the success screen.
export function bundleSiblings(slug: string): string[] {
  const siblings = new Set<string>();
  for (const group of QUESTIONNAIRE_BUNDLES) {
    if (!group.includes(slug)) continue;
    for (const other of group) {
      if (other !== slug && getQuestionnaire(other)) siblings.add(other);
    }
  }
  return [...siblings];
}

// The field IDs of a questionnaire that can round-trip through a URL — every
// field except file uploads (which can't be prefilled from a query string).
// Cross-prefill carries the intersection of the source's answers and this set.
export function prefillableFieldIds(slug: string): Set<string> {
  const ids = new Set<string>();
  const q = getQuestionnaire(slug);
  if (!q) return ids;
  for (const section of q.sections) {
    for (const field of section.fields) {
      if (field.type !== "file") ids.add(field.id);
    }
  }
  return ids;
}
