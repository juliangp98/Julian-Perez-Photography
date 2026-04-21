# Sanity CMS

Sanity is the runtime source of truth for journal posts, site-wide settings, service categories (with their packages/add-ons/FAQs), the umbrella groupings that organize them, portfolio metadata, and the about-page copy. Every server-rendered page `await`s its content from `src/lib/content.ts`, which fetches from Sanity first and falls back to hard-coded defaults when unreachable. Client components (Nav megamenu, InquiryForm service select) keep using the sync `*Fallback` exports — catalog-shape churn flows into their bundles at the next deploy.

Portfolio image binaries live in `/public` under the Lightroom → `npm run import-photos` workflow (decision 1A); Sanity stores metadata only and the manifest splice in `src/lib/content.ts` supplies real cover images + galleries at runtime. Publishes in Studio propagate to the site within one round-trip via `/api/sanity-webhook` → `revalidateTag(...)` + `revalidatePath(...)`; a 60s fetch-cache TTL is the fallback if the webhook is misconfigured.

## Active schemas

| Schema | Status | Where it renders |
| --- | --- | --- |
| `journalPost` | Active (free) | `/journal` index + `/journal/[slug]` detail + `/` (the `featured` boolean surfaces one post in a home-page "Latest story" section; unflagged posts don't render there) |
| `siteSettings` | Active singleton | `getSiteSettings()` in `src/lib/content.ts` — feeds layout, home, footer, inquiry form, questionnaire forms, book/client pages, API routes |
| `categoryUmbrella` | Active locked-set | `getUmbrellas()` in `src/lib/content.ts` — drives `/services` index + `/portfolio` index + questionnaire index umbrella sections. Client Nav megamenu uses the sync `UMBRELLAS` fallback. |
| `serviceCategory` (+ inline `pkg` / `addOn`) | Active (free) | `getServices()` / `getVisibleServices()` / `getService(slug)` / `getServicesByUmbrella()` — drives `/services`, `/services/[category]` (incl. `generateStaticParams`), `/sitemap.ts`, `/page.tsx`, `/api/inquire`, `/api/questionnaire`, and the portfolio + questionnaire cross-link surfaces. Client Nav + InquiryForm use the sync `services` / `servicesByUmbrellaFallback()` exports. |
| `portfolioCategory` | Active (free) | `getPortfolios()` / `getVisiblePortfolios()` / `getPortfolio(slug)` / `getPortfoliosByUmbrella()` — drives `/portfolio`, `/portfolio/[category]` (incl. `generateStaticParams`), `/sitemap.ts`, `/page.tsx`, and the services cross-link. Metadata-only: `coverImage` + `images[]` come from `src/lib/portfolio-manifest.ts` (Lightroom workflow) at runtime. Client Nav uses the sync `portfoliosByUmbrellaFallback()` export. |
| `aboutPage` | Active singleton | `getAboutPage()` in `src/lib/content.ts` — drives `/about`. Per-field merge onto `aboutPageFallback`. Cross-page fields (coverageArea, bookingStatus, contactEmail) stay on siteSettings so all pages read a single authoritative source. |

New schemas should follow the same rendering-gated rollout: keep them out of `sanity.config.ts` until the consuming page is ready so editors never see a doc type that doesn't yet surface on the site.

## Doc-type guardrails

The Studio config (`sanity.config.ts`) classifies docs into three buckets:

- **Singleton** (`siteSettings`, `aboutPage`): exactly one doc, pinned at the top of the rail, create/duplicate/delete hidden.
- **Locked set** (`categoryUmbrella`): fixed number of docs where the set is code-controlled (mirrors the `Umbrella` union in `src/lib/types.ts`). Listed in the rail, editable, but create/duplicate/delete hidden so editors can't invalidate the code-level type.
- **Free** (`journalPost`, `serviceCategory`, `portfolioCategory`): editors can freely create, duplicate, and delete — the rendering side handles arbitrary sets.

## Webhook revalidation

`src/app/api/sanity-webhook/route.tsx` receives Sanity's webhook POSTs, verifies the `sanity-webhook-signature` header against `SANITY_WEBHOOK_SECRET` using `@sanity/webhook`'s `isValidSignature` (HMAC-SHA256 over the raw request body), then switches on `_type` and invalidates **both** cache layers:

- `revalidateTag(tag, { expire: 0 })` on the collection tag (and the per-slug tag when applicable: `serviceCategory:<slug>`, `portfolioCategory:<slug>`, `journalPost:<slug>`) — busts Next's Data Cache so the next render refetches from Sanity.
- `revalidatePath(path)` on each route that actually renders the changed content — busts Vercel's edge/CDN cache (`s-maxage=60` on the rendered HTML) so the next request is a cold miss instead of serving cached HTML until its TTL expires.

Without the path-level call, the webhook returned 200 but the site kept serving stale HTML for up to 60s — both calls together deliver sub-second end-to-end propagation. `siteSettings` is special-cased to `revalidatePath("/", "layout")` because it lives in the root layout and participates in every route's render. The `{ expire: 0 }` profile on `revalidateTag` is Next 16's opt-in for immediate expiration — right for webhook-driven revalidation where the next request should cold-refetch rather than serve stale while revalidating in the background.

Path map (doc-type → routes) lives in the handler's `pathsForType` helper. Kept tight — a `serviceCategory` edit doesn't purge `/journal` — so one publish doesn't cold-start the whole site. When you add a new schema or surface existing content on a new route, update **both** the path map and the tag strategy in the handler.

### Configuring the Sanity side

Required env var (see `.env.example` for the full doc):

```
SANITY_WEBHOOK_SECRET=<64 random hex chars>
```

Generate with `openssl rand -hex 32`. Paste the same value into `.env.local` (for local testing via ngrok or similar) and into the production deploy env (Vercel → Project → Settings → Environment Variables).

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

After saving, publish any doc in Studio and check the "Attempts" tab on the webhook — a `200 { revalidated: true, tags: [...] }` response means the handler saw the request and invalidated the cache. Hard-refresh the corresponding site page and the edit should appear immediately.

## Setup checklist for a fresh clone

1. Create a free Sanity account at https://sanity.io and create a new project. Note the **project ID** and **dataset** (usually `production`).
2. Add to `.env.local`:
   ```
   NEXT_PUBLIC_SANITY_PROJECT_ID=your_project_id
   NEXT_PUBLIC_SANITY_DATASET=production
   ```
3. `npm run seed:sanity` (after following the write-token instructions in the repo `README.md`) to populate the dataset from the hard-coded defaults in `src/lib/*-data.ts`.
4. `npm run dev`, visit `/studio`, sign in, and confirm every schema has a seeded document.
5. (Optional but recommended) Configure `SANITY_WEBHOOK_SECRET` and register the webhook above so publishes propagate instantly.

## Schema files

- `journalPost.ts` — journal posts (free)
- `siteSettings.ts` — singleton; contact info, booking URL, payment prefs, testimonials, calls, social links
- `categoryUmbrella.ts` — locked-set; 4 code-controlled umbrella groupings
- `serviceCategory.ts` — services & pricing pages (includes `pkg` + `addOn` inline object types)
- `portfolioCategory.ts` — portfolio metadata; binaries stay in `/public` via the Lightroom workflow
- `aboutPage.ts` — singleton; heading + bio paragraphs + optional headshot path for `/about`

See each file for exact field definitions and the design decisions behind field-shape choices.

## Deferred

- Draft previews via `SANITY_API_READ_TOKEN` + Next Draft Mode + Sanity Presentation Tool
- `/journal/tag/[tag]` index pages
- `/journal/rss.xml` feed
- Publish-then-assert e2e spec — needs a dedicated test-only token + scratch dataset before it can land without wiring credentials into CI
