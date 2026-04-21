// Top-level grouping for services and portfolios. Examples:
// "Weddings & Couples", "Family & Life Events", "Portraits & Pro",
// "Brand & Events". Used by the nav megamenu, the /services index, and
// the portfolio index to cluster related categories together.
//
// Why this is a document type rather than a hard-coded enum:
//   - Julian wants to be able to rename / restructure umbrellas without a
//     code change (decision 2B). The machine `id` stays stable (it's
//     referenced from code in generators and JSON-LD), but `title`,
//     `tagline`, and `order` are editor-controlled.
//   - Each serviceCategory holds a `reference → categoryUmbrella` so
//     moving a service between umbrellas is one dropdown change.
//
// The seed script upserts the 4 canonical umbrellas from UMBRELLAS in
// src/lib/types.ts at stable ids `umbrella-<id>`. Editors shouldn't add
// or delete umbrella docs — structural changes to the set need a code
// change so the `Umbrella` union in types.ts stays in sync.

import { defineField, defineType } from "sanity";

export const categoryUmbrella = defineType({
  name: "categoryUmbrella",
  title: "Category Umbrella",
  type: "document",
  fields: [
    defineField({
      name: "id",
      title: "Machine ID",
      type: "string",
      description:
        "Stable identifier — must match the `Umbrella` union in src/lib/types.ts. Do not change; renaming the visible label is the Title field below.",
      readOnly: true,
      validation: (r) => r.required(),
    }),
    defineField({
      name: "title",
      type: "string",
      description: "Visible label in the nav megamenu and /services index.",
      validation: (r) => r.required(),
    }),
    defineField({
      name: "tagline",
      type: "string",
      description:
        "Short subtitle shown under the umbrella heading on index pages.",
    }),
    defineField({
      name: "order",
      type: "number",
      description:
        "Sort order in nav and index pages (lower shows first). Defaults to index position from types.ts when seeded.",
      validation: (r) => r.required(),
    }),
  ],
  orderings: [
    {
      title: "Display order",
      name: "orderAsc",
      by: [{ field: "order", direction: "asc" }],
    },
  ],
  preview: {
    select: { title: "title", subtitle: "id" },
  },
});
