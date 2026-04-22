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
