// Pure-data module: exports the hard-coded `portfolios` array (the 16
// portfolio categories with metadata — slug, umbrella, title,
// description, placeholder cover path, hidden flag). Zero runtime
// imports beyond types so the seed script (`scripts/seed-sanity.ts`)
// can import it under tsx without pulling React, Next, or the Sanity
// client into scope.
//
// What lives here vs. portfolio-manifest.ts vs. content.ts:
//   - **portfolios-data.ts (this file)** — metadata fallback + seed
//     source: slug, umbrella, title, description, placeholder
//     coverImage, hidden flag. Zero runtime imports.
//   - **portfolio-manifest.ts** — auto-generated from Lightroom via
//     `npm run import-photos`. Maps slug → {coverImage, images[]}
//     with real dimensions + LQIP. Not checked in to Sanity.
//   - **content.ts** — splices the manifest over `portfoliosFallback`
//     at module load, exposes async `getPortfolios()` etc.
//
// Consequence: editing `portfoliosFallback` + re-running the seed
// changes the metadata (title, description, umbrella). Changing an
// actual image requires re-running `npm run import-photos`, not a
// Sanity edit — the Lightroom workflow stays the source of truth for
// binaries.
//
// Every entry starts with `coverImage: "/portfolio/placeholder.svg"`
// and `images: []`. The manifest replaces both at runtime for any
// slug that has Lightroom exports; slugs without exports keep the
// placeholder + empty gallery and render the "coming soon" block.

import type { PortfolioCategory } from "./types";

export const portfoliosFallback: PortfolioCategory[] = [
  // Weddings & Couples
  {
    slug: "weddings",
    umbrella: "weddings-couples",
    title: "Weddings",
    description: "Full wedding days, from quiet prep to the last dance.",
    coverImage: "/portfolio/placeholder.svg",
    images: [],
  },
  {
    slug: "engagements-couples",
    umbrella: "weddings-couples",
    title: "Engagements & Couples",
    description: "Engagements, anniversaries, and couples sessions.",
    coverImage: "/portfolio/placeholder.svg",
    images: [],
  },
  // Family & Life Events
  {
    slug: "maternity",
    umbrella: "family-life",
    title: "Maternity",
    description: "Patient, soft sessions to mark the wait.",
    coverImage: "/portfolio/placeholder.svg",
    images: [],
  },
  {
    slug: "newborn",
    umbrella: "family-life",
    title: "Newborn & First Year",
    description: "In-home newborn sessions and first-year milestones.",
    coverImage: "/portfolio/placeholder.svg",
    images: [],
  },
  {
    slug: "family-portraits",
    umbrella: "family-life",
    title: "Family Portraits",
    description: "Posed and candid family portrait sessions.",
    coverImage: "/portfolio/placeholder.svg",
    images: [],
  },
  {
    slug: "family-celebrations",
    umbrella: "family-life",
    title: "Family Celebrations",
    description:
      "1st birthdays, baby showers, gender reveals, reunions, and milestone parties.",
    coverImage: "/portfolio/placeholder.svg",
    images: [],
  },
  {
    slug: "cultural-milestones",
    umbrella: "family-life",
    title: "Cultural Milestones",
    description: "Quinceañeras, Sweet 16s, Bar/Bat Mitzvahs, and more.",
    coverImage: "/portfolio/placeholder.svg",
    images: [],
  },
  {
    slug: "pet",
    umbrella: "family-life",
    title: "Pet Photography",
    description: "In-home and outdoor portraits of the four-legged family.",
    coverImage: "/portfolio/placeholder.svg",
    images: [],
  },
  // Personal & Pro Portraits
  {
    slug: "portraiture",
    umbrella: "portraits-pro",
    title: "Portraiture",
    description: "Individual portraits — guided and natural.",
    coverImage: "/portfolio/placeholder.svg",
    images: [],
  },
  {
    slug: "graduation",
    umbrella: "portraits-pro",
    title: "Graduation",
    description: "Solo and group sessions across the DMV.",
    coverImage: "/portfolio/placeholder.svg",
    images: [],
  },
  {
    slug: "corporate-headshots",
    umbrella: "portraits-pro",
    title: "Corporate Headshots",
    description: "Consistent, polished headshots for teams and individuals.",
    coverImage: "/portfolio/placeholder.svg",
    images: [],
  },
  // Brand & Events
  {
    slug: "corporate-community-events",
    umbrella: "brand-events",
    title: "Corporate & Community Events",
    description:
      "Conferences, galas, receptions, and community events.",
    coverImage: "/portfolio/placeholder.svg",
    images: [],
  },
  {
    slug: "concerts-performances",
    umbrella: "brand-events",
    title: "Concerts & Performances",
    description:
      "Live concerts, band sets, recitals, and stage performances.",
    coverImage: "/portfolio/placeholder.svg",
    images: [],
  },
  {
    slug: "brand-commercial",
    umbrella: "brand-events",
    title: "Brand & Commercial Content",
    description:
      "Studios, instructor portraits, product, and brand campaigns.",
    coverImage: "/portfolio/placeholder.svg",
    images: [],
  },
  {
    slug: "real-estate",
    umbrella: "brand-events",
    title: "Real Estate & Airbnb",
    description: "Listing photos for agents and short-term rental hosts.",
    coverImage: "/portfolio/placeholder.svg",
    images: [],
  },
  // Hidden
  {
    slug: "modeling",
    umbrella: "portraits-pro",
    title: "Modeling",
    description: "Test shoots, portfolios, and editorial work.",
    coverImage: "/portfolio/placeholder.svg",
    images: [],
    hidden: true,
  },
];
