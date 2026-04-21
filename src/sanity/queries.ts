// GROQ queries for journal content. Two things worth noting:
//
// 1. LQIP + dimensions are projected INLINE via `asset->{ url, metadata { lqip, dimensions } }`
//    so the callsite gets everything it needs to render a blur placeholder
//    and set explicit width/height on <Image>. Without this, Next.js
//    would request intrinsic sizes client-side (layout shift) and there
//    would be no base64 available for `blurDataURL`.
//
// 2. Every query passes `next: { revalidate: 60, tags: [...] }` to Next's
//    fetch. 60s is a decent compromise: the journal is not a news site,
//    publishing rhythms are measured in days; a minute's lag between "I
//    published" and "it's on the site" is acceptable. The Sanity webhook
//    at /api/sanity-webhook calls `revalidateTag("journalPost")` on
//    publish, so the TTL is a safety net rather than the primary path.
//
// Published filter: `defined(publishedAt) && publishedAt < now()` — keeps
// drafts + future-dated posts out. When draft-preview mode lands this
// splits into two queries (published + preview).

import { sanityClient, isSanityConfigured } from "./client";
import type { JournalPost, JournalPostCard } from "./types";
import type {
  AboutPage,
  PortfolioCategory,
  ServiceCategory,
  SiteSettings,
  Umbrella,
} from "@/lib/types";

// Portfolio docs in Sanity store metadata ONLY — the `images[]` gallery
// (and the "real" coverImage) are supplied by src/lib/portfolio-manifest.ts
// (auto-generated from Lightroom exports). So GROQ returns a trimmed
// shape; the splice in src/lib/content.ts unions it with the manifest to
// produce a full `PortfolioCategory`.
export type PortfolioMetadata = Omit<PortfolioCategory, "images">;

const POST_CARD_FIELDS = `
  _id,
  title,
  "slug": slug.current,
  publishedAt,
  excerpt,
  tags,
  featured,
  coverImage {
    asset->{ url, metadata { lqip, dimensions } },
    "alt": alt,
    hotspot,
    crop
  }
`;

const POST_FULL_FIELDS = `
  ${POST_CARD_FIELDS},
  body[] {
    ...,
    _type == "image" => {
      asset->{ url, metadata { lqip, dimensions } },
      "alt": alt,
      hotspot,
      crop
    }
  }
`;

// Guard every fetch — fresh clones without env should render the
// "coming soon" placeholder, not crash the route.
function guard<T>(fallback: T): Promise<T> {
  return Promise.resolve(fallback);
}

export async function getAllPosts(): Promise<JournalPostCard[]> {
  if (!isSanityConfigured()) return guard<JournalPostCard[]>([]);
  return sanityClient.fetch<JournalPostCard[]>(
    `*[_type == "journalPost" && defined(publishedAt) && publishedAt < now()]
      | order(publishedAt desc) { ${POST_CARD_FIELDS} }`,
    {},
    { next: { revalidate: 60, tags: ["journalPost"] } },
  );
}

export async function getPostBySlug(slug: string): Promise<JournalPost | null> {
  if (!isSanityConfigured()) return guard<JournalPost | null>(null);
  return sanityClient.fetch<JournalPost | null>(
    `*[_type == "journalPost" && slug.current == $slug][0] { ${POST_FULL_FIELDS} }`,
    { slug },
    { next: { revalidate: 60, tags: [`journalPost:${slug}`, "journalPost"] } },
  );
}

// Drives `generateStaticParams` for /journal/[slug]. On a fresh clone
// this returns [] so the build doesn't try to prerender anything — the
// route still exists and renders on demand once Julian publishes.
export async function getPostSlugs(): Promise<string[]> {
  if (!isSanityConfigured()) return [];
  try {
    return await sanityClient.fetch<string[]>(
      `*[_type == "journalPost" && defined(publishedAt) && publishedAt < now()].slug.current`,
      {},
      { next: { revalidate: 60, tags: ["journalPost"] } },
    );
  } catch {
    // Network hiccup at build time shouldn't break the whole build — the
    // pages will render on demand in that case.
    return [];
  }
}

// ---------------------------------------------------------------------------
// Site settings
//
// Singleton document: there should only ever be one `siteSettings` doc in
// the dataset, pinned to id `siteSettings` by the Studio config + seed
// script. Reading uses the same `revalidate: 60` cadence as the journal
// so Studio edits show up within a minute; the webhook at
// /api/sanity-webhook invalidates sooner on publish.
// ---------------------------------------------------------------------------

const SITE_SETTINGS_ID = "siteSettings";

// GROQ projection kept flat so the returned shape matches the
// `SiteSettings` TS type in src/lib/types.ts 1:1. If the two ever drift
// the consumer code at `getSiteSettings()` (src/lib/content.ts) will
// catch it via `mergeWithFallback` — remote fields overlay the fallback
// object per-key, so missing fields collapse to the hard-coded defaults.
const SITE_SETTINGS_FIELDS = `
  siteName,
  tagline,
  contactEmail,
  coverageArea,
  bookingStatus,
  bookingUrl,
  calls {
    discoveryCall       { label, url },
    planningCall        { label, url },
    weddingTimelineCall { label, url },
    venueWalkthrough    { label, url }
  },
  clientGalleryUrl,
  paymentPreferences,
  social    { instagram, facebook, youtube },
  analytics { ga4Id },
  googleProfileUrl,
  testimonials[] { author, rating, relativeTime, text, source }
`;

export async function getSiteSettings(): Promise<Partial<SiteSettings> | null> {
  if (!isSanityConfigured()) return null;
  return sanityClient.fetch<Partial<SiteSettings> | null>(
    `*[_type == "siteSettings" && _id == $id][0] { ${SITE_SETTINGS_FIELDS} }`,
    { id: SITE_SETTINGS_ID },
    { next: { revalidate: 60, tags: ["siteSettings"] } },
  );
}

// Used by the home page to surface a single editor-flagged post in a
// featured slot between the portfolio teaser and testimonials. Returns
// the MOST RECENTLY published post that has `featured == true` — if
// Julian flags several (e.g. he forgot to un-feature the last one),
// the newest wins rather than requiring him to hunt down old flags.
// The section is silently hidden when this returns null, so an empty
// `featured` set is a valid steady state.
//
// Same `JournalPostCard` shape as the journal index so the rendering
// component can share the LQIP / dims / tags plumbing — no new type
// needed. Tagged `journalPost` so the webhook's existing
// `revalidateTag("journalPost")` + `revalidatePath("/")` combo covers it
// without any new wiring.
export async function getFeaturedPostFromSanity(): Promise<JournalPostCard | null> {
  if (!isSanityConfigured()) return null;
  try {
    return await sanityClient.fetch<JournalPostCard | null>(
      `*[_type == "journalPost"
          && featured == true
          && defined(publishedAt)
          && publishedAt < now()]
        | order(publishedAt desc)[0] { ${POST_CARD_FIELDS} }`,
      {},
      { next: { revalidate: 60, tags: ["journalPost"] } },
    );
  } catch {
    return null;
  }
}

// Used by /journal/[slug] to show "more stories" after the post body.
// Simple "3 most recent other posts" — richer relatedness deferred.
export async function getRelatedPosts(
  currentSlug: string,
): Promise<JournalPostCard[]> {
  if (!isSanityConfigured()) return [];
  return sanityClient.fetch<JournalPostCard[]>(
    `*[_type == "journalPost"
        && defined(publishedAt)
        && publishedAt < now()
        && slug.current != $currentSlug]
      | order(publishedAt desc)[0...3] { ${POST_CARD_FIELDS} }`,
    { currentSlug },
    { next: { revalidate: 60, tags: ["journalPost"] } },
  );
}

// ---------------------------------------------------------------------------
// Service categories + umbrellas
//
// Projection strategy:
//   - `slug` is unwrapped from the Sanity `{_type, current}` shape so the
//     returned object matches the `ServiceCategory` TS type 1:1 — consumers
//     read `s.slug`, not `s.slug.current`.
//   - `umbrella` is flattened from the reference doc down to its `id`
//     string (e.g. "weddings-couples"). The code keys off that id, not
//     the title — renaming an umbrella title in Studio is cosmetic;
//     changing the id requires a deploy because it lives in the
//     `Umbrella` union in src/lib/types.ts.
//   - Array objects (`packages`, `addOns`, `faqs`) are projected
//     field-by-field so Sanity's `_key`/`_type` system fields don't leak
//     through into the runtime type. The shape mirrors the `Package`,
//     `AddOn`, and `FAQ` types.
//
// Consumers in `src/lib/content.ts` merge the remote list into the
// hard-coded `services` fallback (all-or-nothing: if remote has any
// docs, use them; otherwise fall back entirely). A 60s revalidate +
// `serviceCategory` tag keeps Studio edits flowing through without
// requiring a webhook.
// ---------------------------------------------------------------------------

type UmbrellaDoc = { id: Umbrella; title: string; tagline: string };

const SERVICE_FIELDS = `
  "slug": slug.current,
  title,
  "umbrella": umbrella->id,
  tagline,
  description,
  intro,
  comboNote,
  heroImage,
  packages[] {
    name,
    tagline,
    price,
    priceNote,
    duration,
    featured,
    group,
    inclusions
  },
  addOns[] {
    name,
    price,
    description
  },
  pricingNote,
  faqs[] { question, answer },
  hidden,
  order
`;

export async function getServicesFromSanity(): Promise<
  ServiceCategory[] | null
> {
  if (!isSanityConfigured()) return null;
  try {
    const rows = await sanityClient.fetch<ServiceCategory[]>(
      `*[_type == "serviceCategory"] | order(order asc) { ${SERVICE_FIELDS} }`,
      {},
      { next: { revalidate: 60, tags: ["serviceCategory"] } },
    );
    return Array.isArray(rows) ? rows : null;
  } catch {
    return null;
  }
}

// Individual fetch kept separate from `getServicesFromSanity()` so the
// detail page doesn't pay to pull all 16 services just to render one.
// Same projection, per-slug cache tag so a publish on a single service
// only invalidates that page (once webhook revalidation lands in the
// final round-14 ticket).
export async function getServiceBySlugFromSanity(
  slug: string,
): Promise<ServiceCategory | null> {
  if (!isSanityConfigured()) return null;
  try {
    return await sanityClient.fetch<ServiceCategory | null>(
      `*[_type == "serviceCategory" && slug.current == $slug][0] {
        ${SERVICE_FIELDS}
      }`,
      { slug },
      {
        next: {
          revalidate: 60,
          tags: [`serviceCategory:${slug}`, "serviceCategory"],
        },
      },
    );
  } catch {
    return null;
  }
}

// Drives `generateStaticParams` for /services/[category]. Parallels
// `getPostSlugs()` above — a network hiccup at build time returns an
// empty array so the build stays green and pages render on demand.
export async function getServiceSlugsFromSanity(): Promise<string[] | null> {
  if (!isSanityConfigured()) return null;
  try {
    const rows = await sanityClient.fetch<string[]>(
      `*[_type == "serviceCategory" && hidden != true].slug.current`,
      {},
      { next: { revalidate: 60, tags: ["serviceCategory"] } },
    );
    return Array.isArray(rows) ? rows : null;
  } catch {
    return null;
  }
}

export async function getUmbrellasFromSanity(): Promise<UmbrellaDoc[] | null> {
  if (!isSanityConfigured()) return null;
  try {
    const rows = await sanityClient.fetch<UmbrellaDoc[]>(
      `*[_type == "categoryUmbrella"] | order(order asc) {
        id,
        title,
        tagline
      }`,
      {},
      { next: { revalidate: 60, tags: ["categoryUmbrella"] } },
    );
    return Array.isArray(rows) ? rows : null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Portfolio categories
//
// Parallels the services projection above, with two differences:
//   1. No `images[]` — the gallery comes from the Lightroom-generated
//      portfolio-manifest.ts at runtime. GROQ returns metadata only.
//   2. `coverImage` is a plain string path; the manifest overrides it
//      when an export exists for the slug.
//
// Consumers in src/lib/content.ts union the remote metadata with the
// manifest (coverImage + images[] spliced in) before exposing a full
// `PortfolioCategory`. All-or-nothing fallback policy matches services:
// if Sanity returns any docs, trust the list wholesale.
// ---------------------------------------------------------------------------

const PORTFOLIO_FIELDS = `
  "slug": slug.current,
  title,
  "umbrella": umbrella->id,
  description,
  coverImage,
  hidden,
  order
`;

export async function getPortfoliosFromSanity(): Promise<
  PortfolioMetadata[] | null
> {
  if (!isSanityConfigured()) return null;
  try {
    const rows = await sanityClient.fetch<PortfolioMetadata[]>(
      `*[_type == "portfolioCategory"] | order(order asc) { ${PORTFOLIO_FIELDS} }`,
      {},
      { next: { revalidate: 60, tags: ["portfolioCategory"] } },
    );
    return Array.isArray(rows) ? rows : null;
  } catch {
    return null;
  }
}

// Individual fetch for the detail page — same pattern as
// getServiceBySlugFromSanity. Per-slug cache tag so a publish on a
// single portfolio only invalidates that page (once webhook
// revalidation lands in the final round-14 ticket).
export async function getPortfolioBySlugFromSanity(
  slug: string,
): Promise<PortfolioMetadata | null> {
  if (!isSanityConfigured()) return null;
  try {
    return await sanityClient.fetch<PortfolioMetadata | null>(
      `*[_type == "portfolioCategory" && slug.current == $slug][0] {
        ${PORTFOLIO_FIELDS}
      }`,
      { slug },
      {
        next: {
          revalidate: 60,
          tags: [`portfolioCategory:${slug}`, "portfolioCategory"],
        },
      },
    );
  } catch {
    return null;
  }
}

// Drives `generateStaticParams` for /portfolio/[category].
export async function getPortfolioSlugsFromSanity(): Promise<string[] | null> {
  if (!isSanityConfigured()) return null;
  try {
    const rows = await sanityClient.fetch<string[]>(
      `*[_type == "portfolioCategory" && hidden != true].slug.current`,
      {},
      { next: { revalidate: 60, tags: ["portfolioCategory"] } },
    );
    return Array.isArray(rows) ? rows : null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// About page
//
// Singleton document at `_id: "aboutPage"`. Same pattern as siteSettings —
// partial result merged per-field on top of `aboutPageFallback` in
// src/lib/content.ts so a half-edited doc (editor cleared the heading)
// still renders with the hard-coded default.
// ---------------------------------------------------------------------------

const ABOUT_PAGE_ID = "aboutPage";

const ABOUT_PAGE_FIELDS = `
  heading,
  bio,
  headshot
`;

export async function getAboutPageFromSanity(): Promise<
  Partial<AboutPage> | null
> {
  if (!isSanityConfigured()) return null;
  return sanityClient.fetch<Partial<AboutPage> | null>(
    `*[_type == "aboutPage" && _id == $id][0] { ${ABOUT_PAGE_FIELDS} }`,
    { id: ABOUT_PAGE_ID },
    { next: { revalidate: 60, tags: ["aboutPage"] } },
  );
}
