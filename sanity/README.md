# Sanity CMS — migration status

Sanity is the runtime source of truth for journal posts, site-wide
settings, service categories (with their packages/add-ons/FAQs), the
umbrella groupings that organize them, portfolio metadata, and the
about-page copy. Every server-rendered page now `await`s its content
from `src/lib/content.ts`, which fetches from Sanity first and falls
back to hard-coded defaults when unreachable. Client components (Nav
megamenu, InquiryForm service select) keep using the sync `*Fallback`
exports — catalog-shape churn flows into their bundles at the next
deploy. Portfolio image binaries still live in `/public` under the
Lightroom → `npm run import-photos` workflow (decision 1A); Sanity
stores metadata only and the manifest splice supplies real cover images
+ galleries at runtime. Publishes in Studio propagate to the site
within one round-trip via `/api/sanity-webhook` →
`revalidateTag(...)` + `revalidatePath(...)` (see the round-final
section below); a 60s fetch-cache TTL is the fallback if the webhook
is misconfigured. With the webhook ticket landed, the CMS migration
is complete.

## Status

| Schema | Status | Where it renders |
| --- | --- | --- |
| `journalPost` | **Active** (round 13) | `/journal` index + `/journal/[slug]` detail |
| `siteSettings` | **Active singleton** (round 14a) | `getSiteSettings()` in `src/lib/content.ts` — feeds layout, home, footer, inquiry form, questionnaire forms, book/client pages, API routes |
| `categoryUmbrella` | **Active locked-set** (round 14b.2) | `getUmbrellas()` in `src/lib/content.ts` — drives `/services` index + `/portfolio` index + questionnaire index umbrella sections. Client Nav megamenu uses the sync `UMBRELLAS` fallback. |
| `serviceCategory` + `pkg` + `addOn` | **Active** (round 14b.2) | `getServices()` / `getVisibleServices()` / `getService(slug)` / `getServicesByUmbrella()` in `src/lib/content.ts` — drives `/services`, `/services/[category]` (incl. `generateStaticParams`), `/sitemap.ts`, `/page.tsx`, `/api/inquire`, `/api/questionnaire`, and the portfolio + questionnaire cross-link surfaces. Client Nav + InquiryForm use the sync `services` / `servicesByUmbrellaFallback()` exports. |
| `portfolioCategory` | **Active** (round 14c) | `getPortfolios()` / `getVisiblePortfolios()` / `getPortfolio(slug)` / `getPortfoliosByUmbrella()` in `src/lib/content.ts` — drives `/portfolio`, `/portfolio/[category]` (incl. `generateStaticParams`), `/sitemap.ts`, `/page.tsx`, and the services cross-link. Metadata-only: `coverImage` + `images[]` come from `src/lib/portfolio-manifest.ts` (Lightroom workflow) at runtime. Client Nav uses the sync `portfoliosByUmbrellaFallback()` export. |
| `aboutPage` | **Active singleton** (round 14d) | `getAboutPage()` in `src/lib/content.ts` — drives `/about`. Per-field merge onto `aboutPageFallback`. Cross-page fields (coverageArea, bookingStatus, contactEmail) stay on siteSettings so all pages read a single authoritative source. |

With 14d landed there are no more dormant schemas. New schemas added in
later rounds should follow the same rendering-gated rollout: keep them
out of `sanity.config.ts` until the consuming page is ready so editors
never see a doc type that doesn't yet surface on the site.

## Doc-type guardrails

The Studio config (`sanity.config.ts`) classifies docs into three buckets:

- **Singleton** (`siteSettings`, `aboutPage`): exactly one doc, pinned at
  top of the rail, create/duplicate/delete hidden.
- **Locked set** (`categoryUmbrella`): fixed number of docs where the set
  is code-controlled (mirrors `Umbrella` union in `types.ts`). Listed in
  the rail, editable, but create/duplicate/delete hidden so editors can't
  invalidate the code-level type.
- **Free** (`journalPost`, `serviceCategory`, `portfolioCategory`):
  editors can freely create, duplicate, and delete — the rendering side
  handles arbitrary sets.

## Round 13 (done) — journal activation

- `sanity.config.ts` at the repo root registers only `journalPost`
- `src/app/studio/[[...tool]]/page.tsx` mounts the embedded `NextStudio`
- `src/sanity/{client,image,queries,types}.ts` handle GROQ fetches + LQIP
- `/journal` pages render with a graceful "coming soon" fallback when env is unset
- `next.config.ts` whitelists `cdn.sanity.io` for `next/image`

Required env vars (see repo `README.md` + `.env.example`):

```
NEXT_PUBLIC_SANITY_PROJECT_ID=
NEXT_PUBLIC_SANITY_DATASET=production
```

## Round 14a (done) — siteSettings activation

- Extended `sanity/schemas/siteSettings.ts` to cover every field surfaced
  on the site (added `calls`, `clientGalleryUrl`, `testimonials[]`,
  `googleProfileUrl`).
- Registered as a singleton in `sanity.config.ts` — pinned to the top of
  the structure rail, with `newDocumentOptions` and `actions` gated so
  editors can't duplicate or delete it.
- `getSiteSettings()` in `src/lib/content.ts` wraps the GROQ fetch in
  React's `cache()` and falls back to `siteSettingsFallback` per-field
  via `mergeWithFallback`.
- The hard-coded defaults live in `src/lib/site-settings-data.ts` — a
  pure-data module with no runtime imports, so the seed script can read
  them under `tsx` without pulling in React/Next.
- `scripts/seed-sanity.ts` (run via `npm run seed:sanity`) upserts the
  singleton at `_id: "siteSettings"` using `createOrReplace`.

## Round 14b.1 (done) — service + umbrella schemas live in Studio

- New `sanity/schemas/categoryUmbrella.ts`: small doc with `id` (read-only,
  code-bound), `title`, `tagline`, `order`. Decision 2B — editable in
  Studio so restructuring umbrellas doesn't require a code change.
- Extended `sanity/schemas/serviceCategory.ts` to cover every field the
  TS type uses today: `umbrella` (reference → categoryUmbrella), `intro`,
  `comboNote`, `faqs`, `hidden`, plus `pkg.tagline` and `pkg.group`.
  `heroImage` is a plain string path (Lightroom workflow per decision 1A).
- Extracted the 16-service array from `content.ts` → new pure-data module
  `src/lib/services-data.ts` (parallel to `site-settings-data.ts`) so the
  seed script imports it under `tsx` without pulling in React/Next.
- `scripts/seed-sanity.ts` now upserts **1 siteSettings + 4 umbrellas +
  16 services** in one run. Deterministic `_key`s on array items so re-
  seeding is idempotent.
- **Runtime unchanged** — `/services`, `/services/[category]`, the nav
  megamenu, the inquiry form, and the sitemap all still read from
  `src/lib/content.ts` / `services-data.ts`. 14b.2 swaps those over.

## Round 14b.2 (done) — services consumed from Sanity at runtime

- `src/sanity/queries.ts` now exposes `getServicesFromSanity`,
  `getServiceBySlugFromSanity`, `getServiceSlugsFromSanity`, and
  `getUmbrellasFromSanity`. Projections unwrap `slug.current` and
  dereference `umbrella->id` inline so the returned shape matches the
  `ServiceCategory` / `Umbrella` TS types 1:1 — consumers never see
  Sanity's wrapper envelopes.
- `src/lib/content.ts` adds React-`cache()`-wrapped `getServices()`,
  `getVisibleServices()`, `getService(slug)`, `getUmbrellas()`, and
  `getServicesByUmbrella()`. All-or-nothing fallback policy: if Sanity
  returns any services, trust that list wholesale (editors own the
  catalog shape now — the seed keeps defaults + dataset in lockstep);
  if empty or unreachable, fall back to the hard-coded `services` +
  `UMBRELLAS` arrays. A defensive filter drops services whose umbrella
  reference failed to dereference.
- Breaking signature change: `getService(slug)` is async now. All server
  consumers migrated — `/services`, `/services/[category]` (incl.
  `generateStaticParams`), `/page.tsx`, `/sitemap.ts`,
  `/questionnaire`, `/questionnaire/[service]`,
  `/portfolio/[category]`, `/api/inquire`, `/api/questionnaire`.
- Client components (Nav, InquiryForm) switched to the sync
  `servicesByUmbrellaFallback()` / `visibleServices` exports. Staleness
  there tracks deploy cadence, matching the 14a pattern for
  `siteSettingsFallback`.
- Build clean: all 15 non-hidden service detail pages still prerender
  as SSG via `generateStaticParams` → `await getVisibleServices()`.
  Build falls back gracefully when Sanity is unreachable (returns `[]`
  instead of crashing).
- `npm run test:e2e` — 11/11 pass, including a11y on `/services/weddings`.
- **Deferred to the round-14 final ticket**: an e2e spec that publishes
  a Sanity edit and asserts the site reflects it within 60s. Needs a
  dedicated test-only token + scratch dataset before we can land it
  without wiring credentials into CI.

## Round 14c (done) — portfolioCategory consumed from Sanity at runtime

- Reworked `sanity/schemas/portfolioCategory.ts` to the metadata-only
  shape: `slug`, `title`, `umbrella` (reference → categoryUmbrella),
  `description`, `coverImage` (plain string path, same as services'
  `heroImage`), `hidden`, `order`. Dropped the dormant `galleryImage`
  object type and the inline `images[]` array — the Lightroom workflow
  keeps `/public` as the source of truth for binaries (decision 1A).
- Extracted the 16-portfolio array from `content.ts` → new pure-data
  module `src/lib/portfolios-data.ts` (parallel to `services-data.ts`
  and `site-settings-data.ts`) so `scripts/seed-sanity.ts` imports it
  under `tsx` without pulling in React/Next.
- `scripts/seed-sanity.ts` now upserts **1 siteSettings + 4 umbrellas +
  16 services + 16 portfolios** in one run. Portfolio docs at stable
  `_id: "portfolio-<slug>"` so re-seeding is idempotent.
- `src/sanity/queries.ts` exposes `getPortfoliosFromSanity`,
  `getPortfolioBySlugFromSanity`, `getPortfolioSlugsFromSanity`, plus
  a `PortfolioMetadata` type (`Omit<PortfolioCategory, "images">`) —
  the GROQ return shape, before the manifest splice.
- `src/lib/content.ts` adds React-`cache()`-wrapped `getPortfolios()`,
  `getVisiblePortfolios()`, `getPortfolio(slug)`, and
  `getPortfoliosByUmbrella()`. A `spliceManifest()` helper unions the
  (metadata-only) Sanity shape with `portfolio-manifest.ts` so remote +
  local fallback both produce full `PortfolioCategory` objects with
  real cover images + galleries where Lightroom exports exist. Same
  all-or-nothing fallback policy as services.
- Breaking signature change: `getPortfolio(slug)` is async now. All
  server consumers migrated — `/portfolio`, `/portfolio/[category]`
  (incl. `generateStaticParams`), `/page.tsx`, `/sitemap.ts`,
  `/services/[category]` (portfolio cross-link). Home + sitemap now
  run settings/services/portfolios in a single `Promise.all`.
- Client Nav switched to the sync `portfoliosByUmbrellaFallback()`
  export, matching the 14b.2 pattern. Staleness tracks deploy cadence.
- Build clean: 15 non-hidden portfolio detail pages still prerender
  as SSG via `generateStaticParams` → `await getVisiblePortfolios()`.
  Build falls back gracefully when Sanity is unreachable.
- `npm run test:e2e` — 11/11 pass.

## Round 14d (done) — aboutPage consumed from Sanity at runtime

- Reworked `sanity/schemas/aboutPage.ts` to the final singleton shape:
  `heading` (string, required), `bio` (string[] of text blocks, required,
  min 1), `headshot` (optional string path per decision 1A). Scoped down
  from an earlier speculative spec that duplicated coverage-area /
  booking-status / contact-email — those stay on siteSettings so the
  About, Inquire, and Footer pages all read one source of truth.
- Added `AboutPage` type to `src/lib/types.ts` and extracted the
  hard-coded `aboutPageFallback` to `src/lib/about-data.ts` (pure-data
  module, parallel to `site-settings-data.ts` / `services-data.ts` /
  `portfolios-data.ts`) so `scripts/seed-sanity.ts` imports it under
  `tsx` without pulling in React/Next.
- Registered as the second singleton in `sanity.config.ts`
  (`SINGLETON_TYPES`, `SINGLETON_IDS`, pinned rail entry below Site
  Settings). Create/duplicate/delete hidden via the existing
  `document.actions` + `document.newDocumentOptions` gates.
- `scripts/seed-sanity.ts` now upserts **1 siteSettings + 1 aboutPage +
  4 umbrellas + 16 services + 16 portfolios** in one run. About doc at
  stable `_id: "aboutPage"`; `omitUndefined` strips the optional
  `headshot` if absent so Sanity doesn't persist a literal null.
- `src/sanity/queries.ts` exposes `getAboutPageFromSanity()` returning
  `Partial<AboutPage> | null` — partial so the merge helper can fill
  gaps per-field, same pattern as siteSettings.
- `src/lib/content.ts` adds React-`cache()`-wrapped `getAboutPage()`
  with a `mergeAboutWithFallback()` helper. `bio` gets an explicit
  nullish-coalesce onto the fallback paragraphs so a cleared-out remote
  array doesn't render an empty block.
- `src/app/about/page.tsx` migrated: `generateMetadata` still pulls from
  siteSettings; the page body awaits `[getAboutPage(), getSiteSettings()]`
  in parallel and maps `about.bio` to `<p>` nodes. Heading is now the
  Studio-managed `about.heading` instead of the hard-coded "Hi, I'm
  Julian."
- Build clean: `/about` still prerenders as SSG. `npm run test:e2e` —
  11/11 pass.

## Final (done) — webhook revalidation

- `src/app/api/sanity-webhook/route.tsx` receives Sanity's webhook POSTs,
  verifies the `sanity-webhook-signature` header against
  `SANITY_WEBHOOK_SECRET` using `@sanity/webhook`'s `isValidSignature`
  (HMAC-SHA256 over the raw request body), then switches on `_type` and
  invalidates **both** cache layers:
  - `revalidateTag(tag, { expire: 0 })` on the collection tag (and the
    per-slug tag when applicable: `serviceCategory:<slug>`,
    `portfolioCategory:<slug>`, `journalPost:<slug>`) — busts Next's
    Data Cache so the next render refetches from Sanity.
  - `revalidatePath(path)` on each route that actually renders the
    changed content — busts Vercel's edge/CDN cache (`s-maxage=60` on
    the rendered HTML) so the next request is a cold miss instead of
    serving the already-cached HTML until its TTL expires.
  Without the path-level call, the webhook returned 200 but the site
  kept serving the stale HTML for up to 60s — both calls together
  deliver sub-second end-to-end propagation. `siteSettings` is
  special-cased to `revalidatePath("/", "layout")` because it lives in
  the root layout and participates in every route's render. The
  `{ expire: 0 }` profile on `revalidateTag` is Next 16's opt-in for
  immediate expiration — right for webhook-driven revalidation where
  we want the next request to cold-refetch rather than serve stale
  while revalidating in the background.
- Path map (doc-type → routes) lives in the handler's `pathsForType`
  helper. Kept tight — a `serviceCategory` edit doesn't purge
  `/journal` — so one publish doesn't cold-start the whole site. When
  you add a new schema or surface existing content on a new route,
  update **both** the path map and the tag strategy in the handler.
- Allowlisted `_type` values (mirrors what queries.ts actually tags):
  `siteSettings`, `aboutPage`, `categoryUmbrella`, `serviceCategory`,
  `portfolioCategory`, `journalPost`. Unknown types 400 + log — catches
  a new schema being added in Studio before the handler is updated.
- `@sanity/webhook@4` uses the Web Crypto API so the handler works on
  both Node and Edge runtimes. We pin to `nodejs` anyway to match the
  rest of `src/app/api/*` for stack-trace consistency.
- Signature verification runs against the raw text body (`req.text()`)
  before any JSON parsing — re-encoding through `JSON.parse` +
  `JSON.stringify` can drop whitespace and invalidate the HMAC.
- Error response codes: 500 if `SANITY_WEBHOOK_SECRET` is unset
  (deploy misconfigured; Sanity will retry), 401 on missing or invalid
  signature, 400 on invalid JSON or unknown `_type`, 200 with
  `{revalidated, tags, paths, now}` on success. The `paths` field
  echoes what was actually purged so the Sanity webhook attempt log is
  useful when debugging stale-content reports.
- Build clean (route listed as `ƒ /api/sanity-webhook` — dynamic, as
  expected for a mutation endpoint).
- `npm run test:e2e` — 11/11 pass.
- **Deferred e2e spec** (publish an edit and assert the site reflects
  it within a bounded window): carried forward to a later round. Needs
  a dedicated test-only token + scratch dataset before it can land
  without wiring credentials into CI.

### Configuring the Sanity side

Required env var (see `.env.example` for the full doc):

```
SANITY_WEBHOOK_SECRET=<64 random hex chars>
```

Generate with `openssl rand -hex 32`. Paste the same value into
`.env.local` (for local testing via ngrok or similar) and into the
production deploy env (Vercel → Project → Settings → Environment
Variables).

Then at https://sanity.io/manage → project → API → Webhooks → **+Add**:

| Field | Value |
| --- | --- |
| Name | Next.js revalidation |
| URL | `https://julianperezphotography.com/api/sanity-webhook` |
| Dataset | `production` |
| Trigger | Create, Update, Delete |
| Filter | `_type in ["siteSettings", "aboutPage", "categoryUmbrella", "serviceCategory", "portfolioCategory", "journalPost"]` |
| Projection | `{ _id, _type, "slug": slug.current }` |
| HTTP method | POST |
| API version | v2024-05-01 |
| Secret | (the value you just generated) |

After saving, publish any doc in Studio and check the "Attempts" tab on
the webhook — a `200 { revalidated: true, tags: [...] }` response means
the handler saw the request and invalidated the cache. Hard-refresh the
corresponding site page and the edit should appear immediately.

Follow-ups after round 14:

- Draft previews via `SANITY_API_READ_TOKEN` + Next Draft Mode + Presentation Tool
- `/journal/tag/[tag]` index pages
- `/journal/rss.xml` feed
- Home-page featured post surfacing (schema field is already there)

## Setup checklist for a fresh clone

1. Create a free Sanity account at https://sanity.io and create a new project.
   Note the **project ID** and **dataset** (usually `production`).
2. Add to `.env.local`:
   ```
   NEXT_PUBLIC_SANITY_PROJECT_ID=your_project_id
   NEXT_PUBLIC_SANITY_DATASET=production
   ```
3. `npm run dev`, visit `/studio`, sign in, and publish your first `Journal Post`.
4. Hard-refresh `/journal` — the post appears.

## Schema files

- `journalPost.ts` — **active** (round 13)
- `siteSettings.ts` — **active singleton** (round 14a) — source of truth for contact info, booking URL, payment prefs, testimonials
- `categoryUmbrella.ts` — **active locked-set** (round 14b.1) — 4 code-controlled umbrella groupings
- `serviceCategory.ts` — **active** (round 14b.1/14b.2) — powers services & pricing pages (includes `pkg` + `addOn` inline)
- `portfolioCategory.ts` — **active** (round 14c) — powers portfolio galleries; metadata-only, binaries stay in `/public`
- `aboutPage.ts` — **active singleton** (round 14d) — heading + bio paragraphs + optional headshot path for `/about`

See each file for the exact field definitions.
