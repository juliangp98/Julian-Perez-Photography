// Site-wide settings — a singleton document. There should be exactly one
// instance of this in the dataset (seeded from src/lib/content.ts via
// `npm run seed:sanity`). The Studio config in sanity.config.ts hides
// "create new" and "delete" for this type so editors can only edit the
// seeded doc at the stable id `siteSettings`.
//
// Shape mirrors `SiteSettings` in src/lib/types.ts; keep them in lockstep
// when extending either side. The runtime consumer is `getSiteSettings()`
// in src/lib/content.ts, which merges remote values on top of the
// fallback object so a partial doc (e.g. editor unpublished a required
// field) still renders the page.

import { defineField, defineType } from "sanity";

// Re-usable fieldset for the four Square booking links under `calls`.
// Inlined rather than promoted to its own document because the tuple is
// static (discovery / planning / wedding-timeline / venue-walkthrough) —
// Julian only edits the URLs when Square service IDs rotate, not the
// call types themselves.
//
// Note: the validation callback param intentionally has no explicit type.
// `defineField` narrows the rule to the per-field flavor (StringRule,
// UrlRule, …) based on `type`; annotating as the generic `Rule` would
// widen it and collide with that narrowing.
const callLinkFields = [
  defineField({
    name: "label",
    type: "string",
    validation: (r) => r.required(),
  }),
  defineField({
    name: "url",
    type: "url",
    validation: (r) => r.required(),
  }),
];

export const siteSettings = defineType({
  name: "siteSettings",
  title: "Site Settings",
  type: "document",
  fields: [
    defineField({
      name: "siteName",
      type: "string",
      validation: (r) => r.required(),
    }),
    defineField({
      name: "tagline",
      type: "string",
      validation: (r) => r.required(),
    }),
    defineField({
      name: "contactEmail",
      type: "string",
      validation: (r) => r.required().email(),
    }),
    defineField({
      name: "coverageArea",
      type: "string",
      validation: (r) => r.required(),
    }),
    defineField({
      name: "bookingStatus",
      type: "string",
      validation: (r) => r.required(),
    }),
    defineField({
      name: "bookingUrl",
      type: "url",
      validation: (r) => r.required(),
    }),
    defineField({
      name: "calls",
      title: "Square call-booking URLs",
      description:
        "The four Square appointment types surfaced on the site. Edit when Square service IDs change.",
      type: "object",
      fields: [
        defineField({
          name: "discoveryCall",
          type: "object",
          fields: callLinkFields,
        }),
        defineField({
          name: "planningCall",
          type: "object",
          fields: callLinkFields,
        }),
        defineField({
          name: "weddingTimelineCall",
          type: "object",
          fields: callLinkFields,
        }),
        defineField({
          name: "venueWalkthrough",
          type: "object",
          fields: callLinkFields,
        }),
      ],
    }),
    defineField({
      name: "clientGalleryUrl",
      title: "Pic-Time client portal URL",
      type: "url",
      validation: (r) => r.required(),
    }),
    defineField({
      name: "paymentPreferences",
      type: "text",
      rows: 2,
    }),
    defineField({
      name: "social",
      type: "object",
      fields: [
        defineField({ name: "instagram", type: "url" }),
        defineField({ name: "facebook", type: "url" }),
        defineField({ name: "youtube", type: "url" }),
      ],
    }),
    defineField({
      name: "analytics",
      type: "object",
      fields: [defineField({ name: "ga4Id", type: "string" })],
    }),
    defineField({
      name: "googleProfileUrl",
      title: "Google Business Profile public link",
      type: "url",
      description:
        "Used as the 'see all reviews' attribution link under the testimonials grid when the Places API isn't reachable.",
    }),
    defineField({
      name: "testimonials",
      description:
        "Manually curated reviews — fallback when the Google Places API isn't reachable (Julian's business profile is service-area, no published address).",
      type: "array",
      of: [
        {
          type: "object",
          fields: [
            defineField({
              name: "author",
              type: "string",
              validation: (r) => r.required(),
            }),
            defineField({
              name: "rating",
              type: "number",
              validation: (r) => r.required().min(1).max(5).integer(),
            }),
            defineField({
              name: "relativeTime",
              type: "string",
              description: "Free-form, e.g. 'a month ago' or 'Sep 24, 2023'.",
              validation: (r) => r.required(),
            }),
            defineField({
              name: "text",
              type: "text",
              rows: 4,
              validation: (r) => r.required(),
            }),
            defineField({
              name: "source",
              type: "string",
              description: "Defaults to 'Google' if blank.",
            }),
          ],
          preview: {
            select: { title: "author", subtitle: "relativeTime" },
          },
        },
      ],
    }),
  ],
  preview: {
    prepare: () => ({ title: "Site Settings" }),
  },
});
