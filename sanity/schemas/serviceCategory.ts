// Service category — one per /services/<slug> page. Mirrors the
// `ServiceCategory` TS type in src/lib/types.ts; keep them in lockstep
// when extending either side. Seeded from src/lib/services-data.ts via
// `npm run seed:sanity`.
//
// Notes on field choices:
//   - `umbrella` is a reference to `categoryUmbrella` (decision 2B) so
//     restructuring the umbrella set is an editor action, not a code
//     change. The referenced doc's `id` must still match the `Umbrella`
//     union in types.ts — code still keys off that id.
//   - `heroImage` is a plain string (path to /public/<slug>/...)
//     rather than a Sanity image asset. This keeps the Lightroom →
//     public/ import workflow intact (decision 1A); editors uploading
//     hero images in Studio would diverge from the Lightroom-exported
//     source of truth.
//   - `intro`, `comboNote`, and `faqs[].answer` allow markdown-flavored
//     strings (used sparingly — e.g. one inline link in comboNote). The
//     render layer (src/app/services/[category]/page.tsx) already parses
//     a narrow markdown subset. Not promoted to Portable Text here
//     because the existing content is 99% plain paragraphs and
//     Portable Text is the wrong shape for "5–6 paragraphs + 1 link."
//   - `hidden` mirrors the TS flag — hides the category from nav,
//     listings, sitemap, and static-param generation without deleting.

import { defineField, defineType } from "sanity";

// Re-usable validation callback — the param is typed narrowly by Sanity
// based on the field's `type`, so don't annotate it as the generic `Rule`
// (that collides with the per-field narrowing and breaks the build).
// Matches the pattern in siteSettings.ts.

export const pkg = defineType({
  name: "pkg",
  title: "Package",
  type: "object",
  fields: [
    defineField({
      name: "name",
      type: "string",
      validation: (r) => r.required(),
    }),
    defineField({
      name: "tagline",
      type: "string",
      description:
        "Short one-liner under the package name (e.g. 'The top choice for an all-in-one experience').",
    }),
    defineField({
      name: "price",
      type: "string",
      description: "Free-form — e.g. '$3,600' or 'Starting at $1,200'.",
      validation: (r) => r.required(),
    }),
    defineField({
      name: "priceNote",
      type: "string",
      description: "Small muted note rendered next to the price.",
    }),
    defineField({
      name: "duration",
      type: "string",
      description: "E.g. 'Full day (prep → sendoff)' or '2 hours'.",
    }),
    defineField({
      name: "featured",
      type: "boolean",
      initialValue: false,
      description:
        "Highlight this package on the service page (accent border / badge).",
    }),
    defineField({
      name: "group",
      type: "string",
      description:
        "Optional sub-section label — e.g. 'Solo' vs 'Group' for graduation packages. Leave blank for most services.",
    }),
    defineField({
      name: "inclusions",
      type: "array",
      of: [{ type: "string" }],
      validation: (r) => r.required().min(1),
    }),
  ],
  preview: {
    select: { title: "name", subtitle: "price" },
  },
});

export const addOn = defineType({
  name: "addOn",
  title: "Add-on",
  type: "object",
  fields: [
    defineField({
      name: "name",
      type: "string",
      validation: (r) => r.required(),
    }),
    defineField({
      name: "price",
      type: "string",
      validation: (r) => r.required(),
    }),
    defineField({
      name: "description",
      type: "string",
    }),
  ],
  preview: {
    select: { title: "name", subtitle: "price" },
  },
});

// FAQ object used for the `faqs` array. Each entry drives a Q/A block on
// the service page and a FAQPage JSON-LD entry for Google rich results.
const faqFields = [
  defineField({
    name: "question",
    type: "string",
    validation: (r) => r.required(),
  }),
  defineField({
    name: "answer",
    type: "text",
    rows: 3,
    description:
      "Plain text — markdown is not rendered here. Keep to 2–3 sentences.",
    validation: (r) => r.required(),
  }),
];

export const serviceCategory = defineType({
  name: "serviceCategory",
  title: "Service Category",
  type: "document",
  fields: [
    defineField({
      name: "slug",
      type: "slug",
      options: { source: "title", maxLength: 60 },
      description:
        "URL slug — must match the `ServiceSlug` union in src/lib/types.ts. Changing this breaks /services/<slug> URLs.",
      validation: (r) => r.required(),
    }),
    defineField({
      name: "title",
      type: "string",
      validation: (r) => r.required(),
    }),
    defineField({
      name: "umbrella",
      type: "reference",
      to: [{ type: "categoryUmbrella" }],
      description: "Top-level grouping — controls nav megamenu placement.",
      validation: (r) => r.required(),
    }),
    defineField({
      name: "tagline",
      type: "string",
      description:
        "Hero subtitle, e.g. 'Your whole day, told honestly.'",
      validation: (r) => r.required(),
    }),
    defineField({
      name: "description",
      type: "text",
      rows: 2,
      description: "Short blurb shown under the page title (muted color).",
      validation: (r) => r.required(),
    }),
    defineField({
      name: "intro",
      type: "array",
      of: [{ type: "text", rows: 3 }],
      description:
        "Long-form philosophy paragraphs shown above the packages grid. Each item is one paragraph.",
    }),
    defineField({
      name: "comboNote",
      type: "text",
      rows: 3,
      description:
        "Optional upsell / cross-link note rendered between the intro and the packages. Supports a narrow markdown subset (inline links only).",
    }),
    defineField({
      name: "heroImage",
      type: "string",
      description:
        "Path to a hero image in /public (e.g. '/portfolio/weddings/hero.jpg'). Leave blank to use the default treatment. Uploads live in /public under the Lightroom-export workflow — this field is just a path.",
    }),
    defineField({
      name: "packages",
      type: "array",
      of: [{ type: "pkg" }],
      description:
        "Ordered most-expensive → least-expensive by convention. The Studio array ordering is the render ordering.",
      validation: (r) => r.required().min(1),
    }),
    defineField({
      name: "addOns",
      type: "array",
      of: [{ type: "addOn" }],
    }),
    defineField({
      name: "pricingNote",
      type: "text",
      rows: 2,
      description:
        "Footnote under the packages grid — typically a travel/custom-quote mention.",
    }),
    defineField({
      name: "faqs",
      type: "array",
      of: [{ type: "object", fields: faqFields }],
      description:
        "Drives both the on-page Q/A section and a FAQPage JSON-LD block for Google rich results.",
    }),
    defineField({
      name: "hidden",
      type: "boolean",
      initialValue: false,
      description:
        "If true, excluded from nav, listings, sitemap, and generateStaticParams. The doc stays in Sanity so content isn't lost.",
    }),
    defineField({
      name: "order",
      type: "number",
      description:
        "Sort order within its umbrella (lower shows first). Defaults to the array position from src/lib/services-data.ts when seeded.",
    }),
  ],
  orderings: [
    {
      title: "Display order",
      name: "orderAsc",
      by: [{ field: "order", direction: "asc" }],
    },
    {
      title: "Title A–Z",
      name: "titleAsc",
      by: [{ field: "title", direction: "asc" }],
    },
  ],
  preview: {
    select: {
      title: "title",
      subtitle: "umbrella.title",
      hidden: "hidden",
    },
    prepare({ title, subtitle, hidden }) {
      return {
        title: hidden ? `${title} (hidden)` : title,
        subtitle,
      };
    },
  },
});
