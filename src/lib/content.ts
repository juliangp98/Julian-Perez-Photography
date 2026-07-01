import { cache } from "react";
import {
  UMBRELLAS,
  type AboutPage,
  type PortfolioCategory,
  type PortfolioImage,
  type ServiceCategory,
  type SiteImage,
  type SiteSettings,
  type Umbrella,
} from "./types";
import { urlFor } from "@/sanity/image";
import type { SanityImageAsset } from "@/sanity/types";
import { portfolioManifest } from "./portfolio-manifest";
import { aboutImages } from "./about-manifest";
import { siteSettingsFallback } from "./site-settings-data";
import { services } from "./services-data";
import { portfoliosFallback } from "./portfolios-data";
import { aboutPageFallback } from "./about-data";
import {
  getSiteSettings as fetchSiteSettingsFromSanity,
  getServicesFromSanity,
  getUmbrellasFromSanity,
  getPortfoliosFromSanity,
  getAboutPageFromSanity,
  getFeaturedPostFromSanity,
  type PortfolioMetadata,
  type SiteSettingsRemote,
  type ServiceCategoryRemote,
  type AboutPageRemote,
} from "@/sanity/queries";
import type { JournalPostCard } from "@/sanity/types";

/**
 * Wrap a Sanity fetch with a try/catch-to-fallback guard and React's
 * request-scoped cache. Returns the fallback on any thrown error
 * (network, auth, malformed response) or on a nullish result — callers
 * should never see a Sanity outage propagate into a rendered 500.
 *
 * Every site-content getter in this file follows the same contract:
 * "return the best-available value; degrade to hard-coded defaults
 * before failing loudly." Centralizing that in one wrapper keeps the
 * per-resource getters focused on their projection/merge logic instead
 * of re-implementing the same try/catch + `cache()` boilerplate six
 * times. The generic `T` can be nullable (see `getFeaturedPost`) — a
 * nullish result and a thrown error both collapse to the fallback via
 * `result ?? fallback`.
 */
function cacheSanityFetch<T>(
  fetchFn: () => Promise<T | null | undefined>,
  fallback: T,
): () => Promise<T> {
  return cache(async () => {
    try {
      const result = await fetchFn();
      return result ?? fallback;
    } catch {
      return fallback;
    }
  });
}

// ---------------------------------------------------------------------------
// Site-wide settings — hard-coded fallback + seed source.
//
// Sanity is the runtime source of truth for site settings.
// `siteSettingsFallback` serves two roles:
//
//   1. **Fallback** — every server consumer calls `getSiteSettings()`
//      below, which fetches from Sanity when configured and returns the
//      fallback otherwise (fresh clones, CI, Sanity-unreachable edge
//      cases). Missing remote fields get merged in per-key via
//      `mergeWithFallback` so a partial doc still renders.
//
//   2. **Seed source** — `scripts/seed-sanity.ts` reads the fallback
//      object directly and upserts it to the dataset. Editing the
//      hard-coded values + re-running the seed is the documented path
//      for "change a default without touching Studio."
//
// The literal lives in `./site-settings-data.ts` (pure-data module, no
// runtime imports) so the seed script can import it under `tsx` without
// dragging React, Next, or the Sanity client into scope. Everyday call
// sites keep importing it from here via the re-export below — no churn
// at the import sites.
//
// Keep the object's shape in lockstep with `SiteSettings` in ./types.ts
// AND the Sanity schema at `sanity/schemas/siteSettings.ts`. The TS
// compiler catches local drift; schema drift surfaces as missing GROQ
// fields that fall back to these hard-coded values.
// ---------------------------------------------------------------------------
export { siteSettingsFallback };

// Per-field merge: remote Sanity values overlay the fallback, but a
// missing required remote field collapses to the hard-coded default
// rather than blowing up the page. Nested objects (social, analytics,
// calls) get their OWN per-key merge so a half-edited doc (editor
// cleared one of the four call URLs) still renders with the rest
// intact.
function mergeWithFallback(remote: SiteSettingsRemote): SiteSettings {
  // The hero photo arrives as a raw Sanity asset; resolve it to a SiteImage
  // (absent/malformed → undefined, so the home page keeps its text hero).
  const { heroImage: heroImageRaw, ...rest } = remote;
  return {
    ...siteSettingsFallback,
    ...rest,
    heroImage: toSiteImage(heroImageRaw) ?? undefined,
    social: {
      ...siteSettingsFallback.social,
      ...(remote.social ?? {}),
    },
    analytics: {
      ...siteSettingsFallback.analytics,
      ...(remote.analytics ?? {}),
    },
    calls: {
      ...siteSettingsFallback.calls,
      ...(remote.calls ?? {}),
    },
    // Testimonials are all-or-nothing — if the remote list is present
    // (even empty), it wins; otherwise fall back. Mixing curated
    // testimonials with editor-added ones would create provenance
    // ambiguity.
    testimonials: remote.testimonials ?? siteSettingsFallback.testimonials,
  };
}

/**
 * Resolve site-wide settings. Returns the Sanity-backed document (merged
 * per-field on top of `siteSettingsFallback`) when Sanity is configured
 * and reachable; falls back to `siteSettingsFallback` otherwise.
 *
 * Wrapped via `cacheSanityFetch` so multiple call sites in a single
 * request (layout + home + footer + GoogleReviews, etc.) share one
 * fetch. Across requests, Next's `fetch` cache handles deduplication
 * via the `["siteSettings"]` tag + 60s revalidate window, with webhook-
 * driven invalidation from `/api/sanity-webhook` on publish.
 */
export const getSiteSettings = cacheSanityFetch<SiteSettings>(async () => {
  const remote = await fetchSiteSettingsFromSanity();
  return remote ? mergeWithFallback(remote) : null;
}, siteSettingsFallback);

// ---------------------------------------------------------------------------
// Service categories + umbrellas
//
// Sanity is the runtime source of truth for the 16 service categories
// and the 4 umbrella groupings. The hard-coded `services` array +
// `UMBRELLAS` const serve the same dual role as `siteSettingsFallback`:
//
//   1. **Fallback** — every server consumer calls `getServices()` /
//      `getService(slug)` / `getServicesByUmbrella()` / `getUmbrellas()`
//      below, which fetch from Sanity when configured and return the
//      hard-coded values otherwise (fresh clones, CI, Sanity-unreachable
//      edge cases). If Sanity returns any docs they're trusted wholesale
//      — the seed script (`npm run seed:sanity`) keeps the dataset in
//      lockstep with `services-data.ts`, so "remote returned N ≠ 16
//      services" means "editor intentionally added/removed/renamed,"
//      not "missing data."
//
//   2. **Seed source** — `scripts/seed-sanity.ts` reads `services` +
//      `UMBRELLAS` directly and upserts them at stable `_id`s. Editing
//      the hard-coded values + re-running the seed is the documented
//      path for "restore defaults."
//
// Client components (Nav megamenu, InquiryForm service select) can't
// `await` an async fetch — they import the sync `services` /
// `visibleServices` / `servicesByUmbrellaFallback()` exports instead.
// The staleness tradeoff matches the siteSettings approach: editor
// changes become visible to client-side UI at the next deploy, which
// is acceptable for catalog-shape churn.
//
// Conventions for the fallback array itself:
//   - `description` is the short subtitle under the page title.
//   - `intro` is the long-form body copy, one paragraph per array entry.
//   - Packages are ordered most expensive → least expensive.
//   - Every entry is tagged with an `umbrella` so the nav and index
//     pages can group automatically.
// ---------------------------------------------------------------------------

export { services };

// Visible-only sync fallback — used by client components and anywhere a
// server component needs the hard-coded set without touching Sanity.
// Hidden categories stay in the source array so the content isn't lost,
// but they get excluded from anything indexable or user-facing.
export const visibleServices = services.filter((s) => !s.hidden);

type UmbrellaGroup = {
  id: Umbrella;
  title: string;
  tagline: string;
};

// All-or-nothing merge policy: if Sanity returned any services, trust
// that list wholesale. Defensive filter drops services whose `umbrella`
// reference failed to dereference (e.g. locked-set invariant broken by
// a direct dataset edit outside Studio) — rendering a service with
// `undefined` umbrella would crash the grouping code downstream.
function normalizeRemoteServices(
  remote: ServiceCategoryRemote[] | null,
): ServiceCategory[] | null {
  if (!remote || remote.length === 0) return null;
  const valid = remote
    .filter((s) => !!s.umbrella && !!s.slug)
    // Resolve the raw Studio hero asset → SiteImage (absent → text-only card
    // and detail page, exactly as today).
    .map(({ heroPhoto, ...s }) => ({
      ...s,
      heroPhoto: toSiteImage(heroPhoto) ?? undefined,
    }));
  return valid.length > 0 ? valid : null;
}

/**
 * Resolve the full service catalog (including hidden entries). Sanity-
 * backed with a fallback to the hard-coded `services` array.
 *
 * Wrapped via `cacheSanityFetch` so multiple call sites in a single
 * request (server page + sitemap + generateStaticParams) share one
 * fetch. Next's 60s revalidate + `serviceCategory` cache tag + webhook-
 * driven invalidation handle cross-request freshness.
 */
export const getServices = cacheSanityFetch<ServiceCategory[]>(async () => {
  const remote = await getServicesFromSanity();
  return normalizeRemoteServices(remote);
}, services);

export const getVisibleServices = cache(
  async (): Promise<ServiceCategory[]> => {
    const all = await getServices();
    return all.filter((s) => !s.hidden);
  },
);

/**
 * Look up one service by slug — respects the `hidden` flag so hidden
 * categories 404 for anonymous visitors.
 */
export async function getService(
  slug: string,
): Promise<ServiceCategory | undefined> {
  const visible = await getVisibleServices();
  return visible.find((s) => s.slug === slug);
}

/**
 * The four code-controlled umbrella groupings. Sanity-backed (editors
 * can rename the title/tagline without a deploy), with the hard-coded
 * `UMBRELLAS` array as the fallback + seed source.
 *
 * The `id` field of each umbrella must still match the `Umbrella` union
 * in src/lib/types.ts — that's why the locked-set Studio config blocks
 * create/delete for this doc type.
 */
export const getUmbrellas = cacheSanityFetch<UmbrellaGroup[]>(async () => {
  const remote = await getUmbrellasFromSanity();
  return remote && remote.length > 0 ? remote : null;
}, UMBRELLAS);

/**
 * Services grouped by umbrella — drives the /services index and the
 * nav megamenu (server-rendered consumers). Client consumers use
 * `servicesByUmbrellaFallback()` below.
 */
export const getServicesByUmbrella = cache(async () => {
  const [umbrellas, visible] = await Promise.all([
    getUmbrellas(),
    getVisibleServices(),
  ]);
  return umbrellas.map((u) => ({
    ...u,
    items: visible.filter((s) => s.umbrella === u.id),
  }));
});

// ---------------------------------------------------------------------------
// Portfolio categories
//
// Sanity is the runtime source of truth for portfolio METADATA (title,
// description, umbrella, ordering, hidden flag). Gallery IMAGES resolve
// from the first available source (see `spliceManifest` below): a
// Studio-uploaded Sanity `gallery[]`, else the Lightroom-generated
// `portfolio-manifest.ts` (slug → {coverImage, images[]} with real
// dimensions + LQIP), else a placeholder. The two image sources are never
// merged — a slug uses one or the other — so uploading in Studio
// supersedes the manifest for that slug with no syncing.
//
// Same dual role as services:
//   1. **Fallback** — every server consumer calls `getPortfolios()` /
//      `getPortfolio(slug)` / `getPortfoliosByUmbrella()` below. Sanity-
//      backed when configured, hard-coded `portfoliosFallback` otherwise.
//      All-or-nothing: if Sanity returns any docs, trust the list
//      wholesale.
//   2. **Seed source** — `scripts/seed-sanity.ts` reads `portfoliosFallback`
//      directly and upserts at `_id: "portfolio-<slug>"`.
//
// Client components (Nav megamenu) use the sync `portfoliosByUmbrellaFallback()`
// export. Same staleness tradeoff as services — editor changes become
// visible to client UI at the next deploy.
// ---------------------------------------------------------------------------

// Map one Studio-uploaded Sanity image asset (dereferenced url + metadata) to
// the render-ready `SiteImage` shape every consumer expects. Uses `urlFor` for
// a width-capped, auto-format CDN url (matching the ~2400px Lightroom export
// target), the asset's dimensions for explicit width/height, and its LQIP for
// the blur placeholder — the same plumbing the journal images use. Returns null
// for a malformed/missing asset so callers can skip it, degrading to a fallback
// rather than throwing. Shared across the home hero, about, portfolio
// gallery/cover, and service surfaces.
function toSiteImage(img?: SanityImageAsset | null): SiteImage | null {
  const dims = img?.asset?.metadata?.dimensions;
  if (!img?.asset?.url || !dims) return null;
  return {
    src: urlFor(img).width(2400).auto("format").url(),
    alt: img.alt ?? "",
    width: dims.width,
    height: dims.height,
    blurDataURL: img.asset.metadata?.lqip ?? "",
  };
}

// Wrap a /public image path (Lightroom manifest or a legacy string field) as a
// SiteImage. These carry no intrinsic dimensions or LQIP; the surfaces that use
// them render with `fill`, so the aspect defaults here are only a placeholder.
function pathToSiteImage(src: string, alt = ""): SiteImage {
  return { src, alt, width: 1000, height: 1250, blurDataURL: "" };
}

function galleryToImages(gallery?: SanityImageAsset[]): PortfolioImage[] {
  if (!gallery?.length) return [];
  return gallery.flatMap((img) => {
    const mapped = toSiteImage(img);
    return mapped ? [mapped] : [];
  });
}

// Resolve a portfolio's gallery from the first available source — the seam
// that keeps the render layer source-agnostic:
//   1. Sanity `gallery[]` uploaded in Studio (cover = first image).
//   2. The Lightroom manifest (src/lib/portfolio-manifest.ts).
//   3. The entry's own placeholder coverImage / empty gallery.
// The two image sources are never merged: a slug uses one or the other, so
// uploading in Studio supersedes the manifest for that slug with no syncing.
// Shared between the sync fallback and the async getter. A future
// Blob+Supabase uploader slots in as branch 0 here with no consumer changes.
function spliceManifest(
  entries: Array<PortfolioMetadata | PortfolioCategory>,
): PortfolioCategory[] {
  return entries.map((entry) => {
    const images = "images" in entry ? entry.images : [];
    // Pull the raw Sanity `gallery` + `cover` off (Sanity entries only); they're
    // resolved below and aren't part of `PortfolioCategory`.
    const { gallery, cover, ...rest } = entry as PortfolioMetadata;
    const base: PortfolioCategory = { ...rest, images };

    // A hand-picked Studio cover wins for the card/teaser thumbnail; otherwise
    // the first resolved gallery image is the cover.
    const pickedCover = toSiteImage(cover);

    // 1. Studio gallery wins when it has any usable images.
    const sanityImages = galleryToImages(gallery);
    if (sanityImages.length > 0) {
      const coverPhoto = pickedCover ?? sanityImages[0];
      return {
        ...base,
        coverPhoto,
        coverImage: coverPhoto.src,
        images: sanityImages,
      };
    }

    // 2. Lightroom manifest.
    const m = portfolioManifest[base.slug];
    if (m) {
      const coverPhoto = pickedCover ?? m.images[0];
      return {
        ...base,
        coverPhoto,
        coverImage: coverPhoto?.src ?? m.coverImage,
        images: m.images,
      };
    }

    // 3. Placeholder / empty — a hand-picked cover can still light up cards.
    return pickedCover
      ? { ...base, coverPhoto: pickedCover, coverImage: pickedCover.src }
      : base;
  });
}

// Sync fallback — used for the seed-data comparison, for the client-
// facing Nav megamenu, and for anywhere a server component wants the
// hard-coded list without touching Sanity.
export const portfolios: PortfolioCategory[] = spliceManifest(portfoliosFallback);
export const visiblePortfolios = portfolios.filter((p) => !p.hidden);

// All-or-nothing merge policy, same as services. Dropped entries: those
// with broken umbrella references or missing slugs. Manifest splicing
// runs after normalization so the returned shape always satisfies
// `PortfolioCategory`.
function normalizeRemotePortfolios(
  remote: PortfolioMetadata[] | null,
): PortfolioCategory[] | null {
  if (!remote || remote.length === 0) return null;
  const valid = remote.filter((p) => !!p.umbrella && !!p.slug);
  if (valid.length === 0) return null;
  return spliceManifest(valid);
}

/**
 * Resolve the full portfolio catalog (including hidden entries). Sanity-
 * backed metadata with the Lightroom manifest spliced in; falls back to
 * the hard-coded `portfoliosFallback` array on Sanity outage / missing
 * env.
 */
export const getPortfolios = cacheSanityFetch<PortfolioCategory[]>(async () => {
  const remote = await getPortfoliosFromSanity();
  return normalizeRemotePortfolios(remote);
}, portfolios);

export const getVisiblePortfolios = cache(
  async (): Promise<PortfolioCategory[]> => {
    const all = await getPortfolios();
    return all.filter((p) => !p.hidden);
  },
);

/**
 * Look up one portfolio by slug — respects the `hidden` flag so hidden
 * categories 404 for anonymous visitors.
 */
export async function getPortfolio(
  slug: string,
): Promise<PortfolioCategory | undefined> {
  const visible = await getVisiblePortfolios();
  return visible.find((p) => p.slug === slug);
}

/**
 * Portfolios grouped by umbrella — drives the /portfolio index and the
 * nav megamenu (server-rendered consumers). Client consumers use
 * `portfoliosByUmbrellaFallback()` below.
 */
export const getPortfoliosByUmbrella = cache(async () => {
  const [umbrellas, visible] = await Promise.all([
    getUmbrellas(),
    getVisiblePortfolios(),
  ]);
  return umbrellas.map((u) => ({
    ...u,
    items: visible.filter((p) => p.umbrella === u.id),
  }));
});

// ---------------------------------------------------------------------------
// About page
//
// Sanity is the runtime source of truth for the editable /about surface:
// `heading` + `bio` paragraphs + optional `headshot` path. Cross-page
// info (coverageArea, bookingStatus, contactEmail) continues to live on
// siteSettings so the About, Inquire, and Footer pages all read a single
// authoritative source.
//
// Same dual role + singleton pattern as siteSettings:
//   1. **Fallback** — `/about/page.tsx` calls `getAboutPage()` below,
//      which fetches from Sanity when configured and returns the hard-
//      coded `aboutPageFallback` otherwise. Per-field merge so a
//      partially-filled Studio doc (editor cleared `headshot` but not
//      `bio`) still renders.
//   2. **Seed source** — `scripts/seed-sanity.ts` reads `aboutPageFallback`
//      directly and upserts at `_id: "aboutPage"`.
//
// The literal lives in `./about-data.ts` (pure-data module, no runtime
// imports) so the seed script can import it under `tsx` without dragging
// React, Next, or the Sanity client into scope. Everyday call sites keep
// importing it from here via the re-export below.
//
// Headshot is a string path (Lightroom → `/public`), not a Sanity image
// asset — parallel to `heroImage` on services and `coverImage` on
// portfolios. Image binaries never round-trip through Sanity.
// ---------------------------------------------------------------------------

export { aboutPageFallback };

// Per-field merge: remote Sanity values overlay the fallback, but a
// missing or null remote `bio` collapses to the hard-coded paragraphs
// rather than rendering an empty block. The raw Studio image fields
// (`gallery`, `headshotImage`) are stripped here — they're resolved
// separately by `resolveAboutImages` — so they never leak onto `AboutPage`.
function mergeAboutWithFallback(remote: AboutPageRemote): AboutPage {
  const { gallery, headshotImage, ...rest } = remote;
  void gallery; // resolved separately in resolveAboutImages
  void headshotImage;
  return {
    ...aboutPageFallback,
    ...rest,
    bio: rest.bio ?? aboutPageFallback.bio,
  };
}

// Resolve the About page's render-ready images from the first available
// source, mirroring the portfolio resolver:
//   1. Studio uploads — Sanity `gallery` / `headshotImage` (with LQIP).
//   2. The Lightroom `about/` manifest + string `headshot`/`images` paths.
//   3. Nothing (the sidebar simply doesn't render).
// The two sources are never merged — a Studio gallery supersedes the manifest.
function resolveAboutImages(base: AboutPage, remote?: AboutPageRemote): AboutPage {
  const sanityPhotos = galleryToImages(remote?.gallery);
  const fallbackPaths = aboutImages.length ? aboutImages : base.images ?? [];
  const photos =
    sanityPhotos.length > 0
      ? sanityPhotos
      : fallbackPaths.map((src) => pathToSiteImage(src));

  const headshotPhoto =
    toSiteImage(remote?.headshotImage) ??
    (base.headshot ? pathToSiteImage(base.headshot) : undefined);

  return { ...base, photos, headshotPhoto };
}

/**
 * Resolve the about-page content. Sanity-backed (merged per-field on top
 * of `aboutPageFallback`, with Studio images resolved) when Sanity is
 * configured and reachable; falls back to the hard-coded values otherwise.
 *
 * Wrapped via `cacheSanityFetch` so `generateMetadata` and the page body
 * share one fetch per request. Next's revalidate + `aboutPage` cache tag +
 * webhook-driven invalidation handle cross-request freshness.
 */
export const getAboutPage = cacheSanityFetch<AboutPage>(async () => {
  const remote = await getAboutPageFromSanity();
  const base = remote ? mergeAboutWithFallback(remote) : aboutPageFallback;
  return resolveAboutImages(base, remote ?? undefined);
}, resolveAboutImages(aboutPageFallback));

// ---------------------------------------------------------------------------
// Featured journal post (home-page surfacing)
//
// Unlike every other getter in this file, there is NO hard-coded fallback:
// if Sanity is unreachable or no post is flagged `featured`, the getter
// returns `null` and the home page silently skips the section. That's
// deliberate — the featured slot is editorially curated; showing a random
// "fallback post" would defeat the point, and showing a stale hard-coded
// one would require a code deploy to rotate. Silence is the right default.
//
// The generic `T` binds to `JournalPostCard | null`, so `cacheSanityFetch`'s
// "nullish → fallback" branch simply returns `null` again. `/` is in the
// webhook's `pathsForType("journalPost")` so a publish busts the edge
// cache immediately (see src/app/api/sanity-webhook/route.tsx).
// ---------------------------------------------------------------------------
export const getFeaturedPost = cacheSanityFetch<JournalPostCard | null>(
  async () => getFeaturedPostFromSanity(),
  null,
);

/**
 * Sync services-grouped-by-umbrella for CLIENT components (Nav megamenu).
 * Uses the hard-coded `UMBRELLAS` + `visibleServices` arrays. Server
 * components should call the async `getServicesByUmbrella()` instead so
 * Sanity edits flow through without a redeploy.
 *
 * Client bundles can't `await` async content getters, so this helper
 * accepts the "edit-catalog → redeploy-to-update-nav" cadence for
 * client-side UI — matching the pattern used by `siteSettingsFallback`.
 */
export function servicesByUmbrellaFallback() {
  return UMBRELLAS.map((u) => ({
    ...u,
    items: visibleServices.filter((s) => s.umbrella === u.id),
  }));
}

/**
 * Sync portfolios-grouped-by-umbrella for CLIENT components (Nav
 * megamenu). Same shape as `servicesByUmbrellaFallback()`, same
 * staleness tradeoff — editor changes flow in at the next deploy
 * rather than within the 60s revalidate window. Server components
 * should call the async `getPortfoliosByUmbrella()` instead.
 */
export function portfoliosByUmbrellaFallback() {
  return UMBRELLAS.map((u) => ({
    ...u,
    items: visiblePortfolios.filter((p) => p.umbrella === u.id),
  }));
}
