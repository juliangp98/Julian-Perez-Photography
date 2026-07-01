// Portfolio category — one per /portfolio/<slug> page. Mirrors the
// `PortfolioCategory` TS type in src/lib/types.ts; keep them in lockstep
// when extending either side. Seeded from src/lib/portfolios-data.ts via
// `npm run seed:sanity`.
//
//   Galleries resolve from the first available source (see the resolver
//   in src/lib/content.ts):
//     1. `gallery[]` below — photos uploaded directly in Studio. When this
//        has any images it is the source of truth for the slug, and the
//        first image is the cover.
//     2. The Lightroom manifest (src/lib/portfolio-manifest.ts, written by
//        `npm run import-photos`) — used when `gallery[]` is empty.
//     3. The placeholder `coverImage` path / "coming soon" state otherwise.
//   The two sources are never merged: a slug uses one or the other, so
//   uploading in Studio supersedes the manifest for that slug without any
//   syncing. `coverImage` (string) remains as the manifest/placeholder
//   fallback. Sanity also stores the metadata — title, slug, umbrella,
//   description, ordering, and the visibility flag.
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
        "Either the bare 11-character video ID (e.g. 'dQw4w9WgXcQ') or a full YouTube URL (watch, share, embed, or shorts) — the renderer extracts the ID automatically. The video must be Public or Unlisted; Private videos can't be embedded.",
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
        "Fallback cover path in /public (e.g. '/portfolio/weddings/cover.jpg'), used only when neither the gallery below nor the Lightroom manifest has images. Leave blank to use '/portfolio/placeholder.svg'.",
    }),
    defineField({
      name: "gallery",
      title: "Photo gallery",
      type: "array",
      of: [
        {
          type: "image",
          options: { hotspot: true },
          fields: [
            {
              name: "alt",
              type: "string",
              title: "Alt text",
              description:
                "Describe the photo for screen readers and SEO. No 'photo of' — just what's visible.",
              validation: (r) => r.required(),
            },
            { name: "caption", type: "string", title: "Caption (optional)" },
          ],
        },
      ],
      description:
        "Upload photos to manage this gallery here in Studio — drag to reorder; the first image is the cover. When this has any images it becomes the source of truth for the slug, superseding the Lightroom `import-photos` manifest. Leave empty to keep using the manifest.",
    }),
    defineField({
      name: "cover",
      title: "Cover photo (optional)",
      type: "image",
      options: { hotspot: true },
      description:
        "The thumbnail that represents this collection on the portfolio index and home teaser. Leave empty to use the first gallery image.",
      fields: [
        {
          name: "alt",
          type: "string",
          title: "Alt text",
          validation: (r) => r.required(),
        },
      ],
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
      media: "gallery.0",
    },
    prepare({ title, subtitle, hidden, media }) {
      return {
        title: hidden ? `${title} (hidden)` : title,
        subtitle,
        media,
      };
    },
  },
});
