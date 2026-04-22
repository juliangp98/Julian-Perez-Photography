// Journal post — the editorial/behind-the-lens stories I publish from
// Sanity Studio. Intentionally minimal: title, slug, date, excerpt, cover,
// body, tags, and a `featured` flag that surfaces one post on the home page.
//
// Images (cover + inline body images) use `hotspot: true` so I can
// re-crop in Studio without re-uploading, and carry a required `alt` subfield
// for accessibility — the rendering layer relies on this for <Image alt="…">.

import { defineField, defineType } from "sanity";

export const journalPost = defineType({
  name: "journalPost",
  title: "Journal Post",
  type: "document",
  fields: [
    defineField({
      name: "title",
      type: "string",
      validation: (r) => r.required().max(120),
    }),
    defineField({
      name: "slug",
      type: "slug",
      options: { source: "title", maxLength: 80 },
      validation: (r) => r.required(),
    }),
    defineField({
      name: "publishedAt",
      title: "Published at",
      type: "datetime",
      validation: (r) => r.required(),
      description:
        "The public publish date. Posts with a future publishedAt are hidden from /journal until the date arrives.",
    }),
    defineField({
      name: "excerpt",
      type: "text",
      rows: 3,
      validation: (r) => r.required().max(280),
      description: "Short teaser shown on the journal index and in OG cards.",
    }),
    defineField({
      name: "coverImage",
      title: "Cover image",
      type: "image",
      options: { hotspot: true },
      fields: [
        {
          name: "alt",
          type: "string",
          title: "Alt text",
          description: "Describe the photo for screen readers and SEO.",
          validation: (r) => r.required(),
        },
      ],
      validation: (r) => r.required(),
    }),
    defineField({
      name: "body",
      title: "Body",
      type: "array",
      of: [
        { type: "block" },
        {
          type: "image",
          options: { hotspot: true },
          fields: [
            {
              name: "alt",
              type: "string",
              title: "Alt text",
              validation: (r) => r.required(),
            },
            { name: "caption", type: "string", title: "Caption (optional)" },
          ],
        },
      ],
      validation: (r) => r.required(),
    }),
    defineField({
      name: "tags",
      type: "array",
      of: [{ type: "string" }],
      options: { layout: "tags" },
      description:
        "Loose keywords (e.g. weddings, DMV, behind-the-scenes). Displayed on posts.",
    }),
    defineField({
      name: "featured",
      type: "boolean",
      initialValue: false,
      description: "Reserved for home-page surfacing.",
    }),
  ],
  orderings: [
    {
      title: "Published, newest first",
      name: "publishedAtDesc",
      by: [{ field: "publishedAt", direction: "desc" }],
    },
  ],
  preview: {
    select: {
      title: "title",
      media: "coverImage",
      subtitle: "publishedAt",
    },
    prepare: ({ title, media, subtitle }) => ({
      title,
      media,
      subtitle: subtitle
        ? new Date(subtitle as string).toLocaleDateString("en-US", {
            year: "numeric",
            month: "short",
            day: "numeric",
          })
        : "Unscheduled",
    }),
  },
});
