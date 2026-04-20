import { cache } from "react";
import {
  UMBRELLAS,
  type AboutPage,
  type PortfolioCategory,
  type ServiceCategory,
  type SiteSettings,
  type Umbrella,
} from "./types";
import { portfolioManifest } from "./portfolio-manifest";
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
  type PortfolioMetadata,
} from "@/sanity/queries";

// Site-wide settings — hard-coded fallback + seed source.
//
// After round 14a, Sanity is the runtime source of truth for site
// settings. `siteSettingsFallback` serves two roles:
//
//   1. **Fallback** — every server consumer calls `getSiteSettings()`
//      below, which fetches from Sanity when configured and returns the
//      fallback otherwise (fresh clones, CI, Sanity-unreachable edge
//      cases). Missing remote fields get merged in per-key via
//      `mergeWithFallback` so a partial doc still renders.
//
//   2. **Seed source** — `scripts/seed-sanity.ts` reads the fallback
//      object directly and upserts it to the dataset. Editing the
//      hard-coded values + re-running the seed is the documented path for
//      "I want to change a default without touching Studio."
//
// The literal lives in `./site-settings-data.ts` (pure-data module, no
// runtime imports) so the seed script can import it under `tsx` without
// dragging React, Next, or the Sanity client into scope. Everyday call
// sites keep importing it from here via the re-export below — no churn
// at the import sites.
//
// Keep the object's shape in lockstep with `SiteSettings` in ./types.ts
// AND the Sanity schema at `sanity/schemas/siteSettings.ts`. The type
// system will catch drift on our side; schema drift will surface as
// missing GROQ fields that fall back to these hard-coded values.
export { siteSettingsFallback };

// Per-field merge: remote Sanity values overlay the fallback, but a
// missing required remote field collapses to the hard-coded default
// rather than blowing up the page. Nested objects (social, analytics,
// calls) get their OWN per-key merge so a half-edited doc (editor
// cleared one of the four call URLs) still renders with the rest
// intact.
function mergeWithFallback(
  remote: Partial<SiteSettings>,
): SiteSettings {
  return {
    ...siteSettingsFallback,
    ...remote,
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
    // (even empty), it wins; otherwise fall back. Mixing curated Julian
    // testimonials with editor-added ones would create provenance ambiguity.
    testimonials: remote.testimonials ?? siteSettingsFallback.testimonials,
  };
}

/**
 * Resolve site-wide settings. Returns the Sanity-backed document (merged
 * per-field on top of `siteSettingsFallback`) when Sanity is configured
 * and reachable; falls back to `siteSettingsFallback` otherwise.
 *
 * Wrapped in React's `cache()` so multiple call sites in a single
 * request (layout + home + footer + GoogleReviews, etc.) share one
 * fetch. Across requests, Next's `fetch` cache handles deduplication
 * via the `["siteSettings"]` tag + 60s revalidate window.
 */
export const getSiteSettings = cache(async (): Promise<SiteSettings> => {
  try {
    const remote = await fetchSiteSettingsFromSanity();
    return remote ? mergeWithFallback(remote) : siteSettingsFallback;
  } catch {
    // Transient Sanity outage shouldn't 500 the page — serve the
    // hard-coded values. Next will retry on the next revalidate tick.
    return siteSettingsFallback;
  }
});

// ---------------------------------------------------------------------------
// Service categories + umbrellas (round 14b.2)
//
// After round 14b.2, Sanity is the runtime source of truth for the 16
// service categories and the 4 umbrella groupings. The hard-coded
// `services` array + `UMBRELLAS` const serve the same dual role as
// `siteSettingsFallback`:
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
// The staleness tradeoff matches 14a's siteSettings approach: editor
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
// Hidden categories stay in the source array so we don't lose the content,
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
  remote: ServiceCategory[] | null,
): ServiceCategory[] | null {
  if (!remote || remote.length === 0) return null;
  const valid = remote.filter((s) => !!s.umbrella && !!s.slug);
  return valid.length > 0 ? valid : null;
}

/**
 * Resolve the full service catalog (including hidden entries). Sanity-
 * backed with a fallback to the hard-coded `services` array.
 *
 * Wrapped in React's `cache()` so multiple call sites in a single
 * request (server page + sitemap + generateStaticParams) share one
 * fetch. Next's 60s revalidate + `serviceCategory` cache tag handles
 * cross-request freshness until webhook-driven revalidation lands.
 */
export const getServices = cache(async (): Promise<ServiceCategory[]> => {
  try {
    const remote = await getServicesFromSanity();
    return normalizeRemoteServices(remote) ?? services;
  } catch {
    return services;
  }
});

export const getVisibleServices = cache(
  async (): Promise<ServiceCategory[]> => {
    const all = await getServices();
    return all.filter((s) => !s.hidden);
  },
);

/**
 * Look up one service by slug — respects the `hidden` flag so hidden
 * categories 404 for anonymous visitors. Async after round 14b.2.
 */
export async function getService(
  slug: string,
): Promise<ServiceCategory | undefined> {
  const visible = await getVisibleServices();
  return visible.find((s) => s.slug === slug);
}

/**
 * The four code-controlled umbrella groupings. Sanity-backed (editors
 * can rename the title/tagline without a deploy — see decision 2B in
 * the round-14 plan), with the hard-coded `UMBRELLAS` array as the
 * fallback + seed source.
 *
 * The `id` field of each umbrella must still match the `Umbrella` union
 * in src/lib/types.ts — that's why the locked-set Studio config blocks
 * create/delete for this doc type.
 */
export const getUmbrellas = cache(async (): Promise<UmbrellaGroup[]> => {
  try {
    const remote = await getUmbrellasFromSanity();
    if (remote && remote.length > 0) return remote;
    return UMBRELLAS;
  } catch {
    return UMBRELLAS;
  }
});

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
// Portfolio categories (round 14c)
//
// After round 14c, Sanity is the runtime source of truth for portfolio
// METADATA (title, description, umbrella, ordering, hidden flag). Image
// binaries stay in /public under the Lightroom → `npm run import-photos`
// workflow — decision 1A, same reasoning as `heroImage` on services. The
// auto-generated `portfolio-manifest.ts` maps slug → {coverImage, images[]}
// with real dimensions + LQIP, and we splice that over the Sanity metadata
// at runtime to produce the full `PortfolioCategory`.
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

// Apply the Lightroom manifest on top of a set of portfolio entries
// (local fallback or Sanity-sourced metadata). Metadata-only shapes
// (no `images[]`) get a default empty gallery; real images arrive via
// the manifest splice. This is shared between the sync fallback and
// the async getter so "manifest overrides placeholder coverImage +
// supplies the gallery" behaves identically on both paths.
function spliceManifest(
  entries: Array<PortfolioMetadata | PortfolioCategory>,
): PortfolioCategory[] {
  return entries.map((entry) => {
    const images = "images" in entry ? entry.images : [];
    const base: PortfolioCategory = { ...entry, images };
    const m = portfolioManifest[base.slug];
    if (!m) return base;
    return { ...base, coverImage: m.coverImage, images: m.images };
  });
}

// Sync fallback — used for the seed-data comparison, for the client-
// facing Nav megamenu, and for anywhere a server component wants the
// hard-coded list without touching Sanity. `portfolios` keeps the pre-
// 14c name so existing imports (e.g. `src/lib/content.ts` re-export
// chain) don't churn.
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
 * backed metadata with Lightroom manifest spliced in; falls back to the
 * hard-coded `portfoliosFallback` array on Sanity outage / missing env.
 *
 * Wrapped in React's `cache()` so multiple call sites in a single
 * request (portfolio index + home teaser + sitemap) share one fetch.
 */
export const getPortfolios = cache(async (): Promise<PortfolioCategory[]> => {
  try {
    const remote = await getPortfoliosFromSanity();
    return normalizeRemotePortfolios(remote) ?? portfolios;
  } catch {
    return portfolios;
  }
});

export const getVisiblePortfolios = cache(
  async (): Promise<PortfolioCategory[]> => {
    const all = await getPortfolios();
    return all.filter((p) => !p.hidden);
  },
);

/**
 * Look up one portfolio by slug — respects the `hidden` flag so hidden
 * categories 404 for anonymous visitors. Async after round 14c.
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
// About page (round 14d)
//
// After round 14d, Sanity is the runtime source of truth for the editable
// /about surface: `heading` + `bio` paragraphs + optional `headshot` path.
// Cross-page info (coverageArea, bookingStatus, contactEmail) continues to
// live on siteSettings so the About, Inquire, and Footer pages all read a
// single authoritative source.
//
// Same dual role + singleton pattern as siteSettings (14a):
//   1. **Fallback** — `/about/page.tsx` calls `getAboutPage()` below, which
//      fetches from Sanity when configured and returns the hard-coded
//      `aboutPageFallback` otherwise. Per-field merge so a partially-filled
//      Studio doc (editor cleared `headshot` but not `bio`) still renders.
//   2. **Seed source** — `scripts/seed-sanity.ts` reads `aboutPageFallback`
//      directly and upserts at `_id: "aboutPage"`.
//
// The literal lives in `./about-data.ts` (pure-data module, no runtime
// imports) so the seed script can import it under `tsx` without dragging
// React, Next, or the Sanity client into scope. Everyday call sites keep
// importing it from here via the re-export below.
//
// Headshot is a string path (Lightroom → `/public`, decision 1A), not a
// Sanity image asset — parallel to `heroImage` on services and `coverImage`
// on portfolios. Image binaries never round-trip through Sanity.
// ---------------------------------------------------------------------------

export { aboutPageFallback };

// Per-field merge: remote Sanity values overlay the fallback, but a missing
// or null remote `bio` collapses to the hard-coded paragraphs rather than
// rendering an empty block. `headshot` is optional, so we take whatever the
// spread produces (explicit-undefined from the remote wins only when it's
// genuinely absent, which the query's `omitUndefined` seed already avoids).
function mergeAboutWithFallback(remote: Partial<AboutPage>): AboutPage {
  return {
    ...aboutPageFallback,
    ...remote,
    bio: remote.bio ?? aboutPageFallback.bio,
  };
}

/**
 * Resolve the about-page content. Sanity-backed (merged per-field on top
 * of `aboutPageFallback`) when Sanity is configured and reachable; falls
 * back to the hard-coded values otherwise.
 *
 * Wrapped in React's `cache()` so `generateMetadata` and the page body
 * share one fetch per request. Next's 60s revalidate + `aboutPage` cache
 * tag handles cross-request freshness until webhook-driven revalidation
 * lands.
 */
export const getAboutPage = cache(async (): Promise<AboutPage> => {
  try {
    const remote = await getAboutPageFromSanity();
    return remote ? mergeAboutWithFallback(remote) : aboutPageFallback;
  } catch {
    // Transient Sanity outage shouldn't 500 the About page — serve the
    // hard-coded values. Next will retry on the next revalidate tick.
    return aboutPageFallback;
  }
});

/**
 * Sync services-grouped-by-umbrella for CLIENT components (Nav megamenu).
 * Uses the hard-coded `UMBRELLAS` + `visibleServices` arrays. Server
 * components should call the async `getServicesByUmbrella()` instead so
 * Sanity edits flow through without a redeploy.
 *
 * This is the services-side twin of `siteSettingsFallback` from 14a —
 * client bundles never await async content getters, so we accept the
 * "edit-catalog → redeploy-to-update-nav" cadence for client-side UI.
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
