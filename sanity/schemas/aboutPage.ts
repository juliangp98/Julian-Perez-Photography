// About page — a singleton document. There should be exactly one instance
// in the dataset (seeded from src/lib/about-data.ts via `npm run
// seed:sanity`). The Studio config in sanity.config.ts hides "create new"
// and "delete" for this type so editors can only edit the seeded doc at
// the stable id `aboutPage`.
//
// Shape mirrors `AboutPage` in src/lib/types.ts; keep them in lockstep
// when extending either side. The runtime consumer is `getAboutPage()`
// in src/lib/content.ts, which merges remote values on top of the
// fallback object so a partial doc (e.g. editor cleared the heading)
// still renders the page.
//
// Scope decisions:
//   - `heading`, `bio` cover the editable surface shown on /about today.
//     Everything else on that page (coverage area, booking status,
//     contact email) lives on `siteSettings` and stays there — it's
//     cross-page info, not about-specific.
//   - `headshot` is a plain string path (same pattern as `heroImage` on
//     services and `coverImage` on portfolios — decision 1A). The
//     /about page doesn't render a headshot yet; the field is here so
//     editors can stage the path ahead of the feature landing.
//   - Bio is `string[]` (plain paragraphs) rather than Portable Text.
//     The existing copy is 3 plain paragraphs; Portable Text is the
//     wrong shape for that and would force a serializer layer for a
//     field that doesn't need rich formatting.

import { defineField, defineType } from "sanity";

export const aboutPage = defineType({
  name: "aboutPage",
  title: "About Page",
  type: "document",
  fields: [
    defineField({
      name: "heading",
      type: "string",
      description: "Top headline on /about (e.g. \"Hi, I'm Julian.\").",
      validation: (r) => r.required().max(120),
    }),
    defineField({
      name: "bio",
      type: "array",
      of: [{ type: "text", rows: 4 }],
      description:
        "Bio paragraphs, one per array entry. Plain text — no markdown.",
      validation: (r) => r.required().min(1),
    }),
    defineField({
      name: "headshot",
      type: "string",
      description:
        "Optional path to a headshot in /public (e.g. '/about/julian.jpg'). Follows the Lightroom export workflow — this field is just a path, not a Sanity-hosted image.",
    }),
  ],
  preview: {
    prepare: () => ({ title: "About Page" }),
  },
});
