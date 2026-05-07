// Portfolio category — one per /portfolio/<slug> page. Mirrors the
// `PortfolioCategory` TS type in src/lib/types.ts; keep them in lockstep
// when extending either side. Seeded from src/lib/portfolios-data.ts via
// `npm run seed:sanity`.
//
//   Image binaries live in /public under the Lightroom → `npm run
//   import-photos` workflow, which writes src/lib/portfolio-manifest.ts.
//   The manifest overrides `coverImage` + supplies the full `images[]`
//   gallery at runtime (see the splice in src/lib/content.ts). Sanity
//   therefore stores ONLY metadata — title, slug, umbrella, description,
//   and a placeholder `coverImage` path that the manifest replaces once
//   Lightroom exports exist.
//
//   Consequence: there is no Sanity `image` type here, and no gallery
//   array. Editors don't upload photos in Studio — that would diverge
//   from the Lightroom-exported source of truth. If Julian wants to
//   swap hero images, he re-runs the import script.
//
// Notes on field choices:
//   - `umbrella` reference mirrors `serviceCategory` — same locked-set
//     of 4 umbrellas; editors can reassign a portfolio to a different
//     umbrella without a code change.
//   - `coverImage` is a plain string path (same pattern as `heroImage`
//     on services). Leave blank to use `/portfolio/placeholder.svg`.
//   - `hidden` mirrors the TS flag — hides the category from nav,
//     listings, sitemap, and static-param generation without deleting.

import { defineField, defineType } from "sanity";

// Per-video entry used inside `portfolioCategory.videos[]`. Mirrors the
// `VideoEntry` TS type. The `sourceKind` radio drives conditional visibility
// of the YouTube vs. blob URL fields so Studio editors only see the
// relevant input. The runtime query (src/sanity/queries.ts) collapses
// `sourceKind` + `youtubeId` / `blobUrl` back into a discriminated `source`
// object that matches the TS shape.
export const videoEntry = defineType({
  name: "videoEntry",
  title: "Video Entry",
  type: "object",
  fields: [
    defineField({
      name: "id",
      type: "string",
      validation: (r) => r.required(),
      description:
        "Slug-safe identifier (e.g., 'sarah-marco-2024'). Used as the React key and URL anchor — keep it stable across edits so deep-links don't break.",
    }),
    defineField({
      name: "title",
      type: "string",
      validation: (r) => r.required(),
      description: "Couple's names or film title — e.g., 'Sarah & Marco'.",
    }),
    defineField({
      name: "date",
      type: "date",
      description:
        "Wedding date. Drives the natural-fill sort (newest first) when no manual order is set.",
    }),
    defineField({
      name: "venue",
      type: "string",
      description: "Location or venue name — e.g., 'Goodstone Inn, Middleburg VA'.",
    }),
    defineField({
      name: "description",
      type: "text",
      rows: 2,
      description: "1–2 sentence note shown beneath the title.",
    }),
    defineField({
      name: "sourceKind",
      type: "string",
      options: {
        list: [
          { title: "YouTube", value: "youtube" },
          { title: "Self-hosted (Vercel Blob)", value: "blob" },
        ],
        layout: "radio",
      },
      validation: (r) => r.required(),
      initialValue: "youtube",
      description:
        "YouTube for unblocked tracks; Self-hosted for music-blocked films. Self-hosted videos upload via `npm run upload-video` — paste the printed URL into the Blob URL field below.",
    }),
    defineField({
      name: "youtubeId",
      type: "string",
      description:
        "YouTube video ID — the part after `v=` in https://youtube.com/watch?v=... (e.g., 'dQw4w9WgXcQ').",
      hidden: ({ parent }) =>
        (parent as { sourceKind?: string } | undefined)?.sourceKind !==
        "youtube",
    }),
    defineField({
      name: "blobUrl",
      type: "url",
      description:
        "Vercel Blob URL printed by `npm run upload-video <path>`. Should start with https://...blob.vercel-storage.com.",
      hidden: ({ parent }) =>
        (parent as { sourceKind?: string } | undefined)?.sourceKind !==
        "blob",
    }),
    defineField({
      name: "thumbnail",
      type: "string",
      description:
        "Path to a thumbnail in /public (e.g., '/portfolio/wedding-films/thumbnails/sarah-marco.jpg'). YouTube entries can leave this blank — the renderer falls back to maxresdefault.jpg from i.ytimg.com.",
    }),
    defineField({
      name: "durationSeconds",
      type: "number",
      description:
        "Optional duration in seconds. Displayed as M:SS overlay on the tile.",
    }),
    defineField({
      name: "featured",
      type: "boolean",
      initialValue: false,
      description:
        "Pin to the top of the page as the hero tile. If multiple entries are featured, the most recent date wins.",
    }),
    defineField({
      name: "hidden",
      type: "boolean",
      initialValue: false,
      description: "Hide from the portfolio page without deleting.",
    }),
    defineField({
      name: "order",
      type: "number",
      description:
        "Manual sort order (lower shows first). Leave blank for natural-fill sorting by date.",
    }),
  ],
  preview: {
    select: {
      title: "title",
      subtitle: "venue",
      featured: "featured",
      hidden: "hidden",
    },
    prepare({ title, subtitle, featured, hidden }) {
      const flags = [
        featured ? "★" : null,
        hidden ? "(hidden)" : null,
      ]
        .filter(Boolean)
        .join(" ");
      return {
        title: flags ? `${title} ${flags}` : title,
        subtitle,
      };
    },
  },
});

export const portfolioCategory = defineType({
  name: "portfolioCategory",
  title: "Portfolio Category",
  type: "document",
  fields: [
    defineField({
      name: "slug",
      type: "slug",
      options: { source: "title", maxLength: 60 },
      description:
        "URL slug — must match the `PortfolioSlug` union in src/lib/types.ts. Changing this breaks /portfolio/<slug> URLs AND the portfolio-manifest key lookup.",
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
      name: "description",
      type: "text",
      rows: 2,
      description: "Short blurb shown under the page title (muted color).",
      validation: (r) => r.required(),
    }),
    defineField({
      name: "coverImage",
      type: "string",
      description:
        "Path to a cover image in /public (e.g. '/portfolio/weddings/cover.jpg'). Overridden at runtime by src/lib/portfolio-manifest.ts once Lightroom exports exist for this slug. Leave blank to use '/portfolio/placeholder.svg'.",
    }),
    defineField({
      name: "videos",
      type: "array",
      of: [{ type: "videoEntry" }],
      description:
        "Optional video archive. Photo galleries leave this empty; the wedding-films portfolio populates it. The page renderer switches to a video grid + lightbox when this array has any entries.",
    }),
    defineField({
      name: "serviceSlug",
      type: "string",
      description:
        "Optional override for the 'View pricing' cross-link on the detail page. Defaults to the portfolio's own slug, which works for every current portfolio (each shares a slug with its matching service). Set this only if a future portfolio's slug intentionally diverges from its service's slug.",
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
        "Sort order within its umbrella (lower shows first). Defaults to the array position from src/lib/portfolios-data.ts when seeded.",
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
