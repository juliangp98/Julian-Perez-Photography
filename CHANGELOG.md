# Changelog

A subsystem-level overview of what's been built. Organized by area rather than date — the history is in git.

## Site scaffold

Next.js 16 + React 19 + Tailwind CSS v4, deployed to Vercel. App Router with per-route SSG where possible; dynamic API routes on the Node runtime. LocalBusiness JSON-LD is wired into the root layout from `siteSettings` so the `<head>` of every page carries structured data. `robots.ts` and `sitemap.ts` are auto-derived from the visible service + portfolio getters.

## Inquiry form + email

`/inquire` posts to `/api/inquire`. Resend sends the owner a structured inquiry email plus an auto-reply to the client. The handler writes the inquiry subject line with the event date formatted as `"Aug 15, 2027"`.

Honeypot + in-memory per-IP rate limiting (`src/lib/request-guard.ts`) guard against basic abuse — 5 submissions per 10 minutes per IP, keyed per endpoint so the inquiry form and questionnaire limiters don't share a bucket.

When `RESEND_API_KEY` is unset the handler logs the payload and returns `{ ok: true, dev: true }` so local development works without a Resend account.

## SMS confirmations (optional)

When all three `TWILIO_ACCOUNT_SID` / `TWILIO_AUTH_TOKEN` / `TWILIO_PHONE_FROM` env vars are set, `/api/inquire` also dispatches a Twilio SMS confirmation. Strictly additive to the email flow: SMS is wrapped in try/catch so a Twilio failure never surfaces into the user-facing response. Phone-number normalization (`(703) 555-1234` → `+17035551234`) is a pragmatic DMV-focused pass — Twilio itself rejects malformed numbers server-side.

## Questionnaire system

Schema-driven planning forms at `/questionnaire/[service]`, defined by the `Questionnaire → Section → Field` tree in `src/lib/questionnaires.ts`. Field types: `text`, `textarea`, `email`, `tel`, `date`, `time`, `number`, `select`, `radio`, `checkbox`, and `package` (resolves at render-time from `services[slug].packages` so package lists never drift from pricing).

- Drafts autosave to `localStorage` and clear on successful submit.
- URL query-params prefill fields so clients can land on a partly-filled form from a post-booking email link.
- Conditional `showIf` branches hide/show follow-up fields; the server validates against the same schema so anything hidden on the client is also optional on the server.
- `/api/wedding-plan` renders a PDF preview of the wedding questionnaire for editor / client review.

## Journal (Sanity CMS)

Embedded Studio at `/studio` via `next-sanity`'s `NextStudio`. GROQ queries in `src/sanity/queries.ts` project LQIP + image dimensions inline so the client gets `blurDataURL` and explicit `width` / `height` without a second round-trip. Custom Portable Text serializers (`src/components/PortableText.tsx`) handle brand-styled headings, external-link safety (noreferrer), and inline images via `next/image`.

`/journal` index and `/journal/[slug]` detail pages render with a graceful "coming soon" fallback when `NEXT_PUBLIC_SANITY_PROJECT_ID` is unset — nothing breaks the build.

## Site-wide settings in Sanity

Singleton `siteSettings` doc covers every field surfaced on the site (siteName, tagline, contact info, booking/client-portal URLs, social links, coverage area, payment prefs, testimonials, call-booking CTAs, Google profile URL). Hard-coded fallback at `src/lib/site-settings-data.ts` (pure-data module with no runtime imports) plays a dual role: runtime fallback when Sanity is unreachable, and seed source for `npm run seed:sanity`.

`getSiteSettings()` in `src/lib/content.ts` merges remote values per-field over the fallback — a partial remote doc (editor cleared a field) still renders the page with the remaining fallback values.

## Services + umbrellas in Sanity

Four code-controlled umbrellas (locked-set `categoryUmbrella` docs, mirroring the `Umbrella` union in `src/lib/types.ts`) group 16 service categories with inline `pkg` + `addOn` objects plus FAQs. Runtime source of truth is Sanity; client Nav + InquiryForm use sync `servicesByUmbrellaFallback()` exports so catalog-shape churn lands at the next deploy rather than the next minute.

All-or-nothing fallback policy: if Sanity returns any services, the list is trusted wholesale (editors own the catalog shape now); if empty or unreachable, the hard-coded `services` array from `src/lib/services-data.ts` takes over.

## Portfolios in Sanity

Portfolio metadata (title, slug, umbrella, description, cover path, order, hidden) lives in Sanity. Image binaries stay in `/public` under the Lightroom → `npm run import-photos` workflow. `spliceManifest()` in `src/lib/content.ts` unions Sanity metadata with `src/lib/portfolio-manifest.ts` at runtime so every `PortfolioCategory` consumer sees the full gallery shape.

15 non-hidden portfolio detail pages prerender as SSG via `generateStaticParams` → `await getVisiblePortfolios()`.

## About page in Sanity

Singleton `aboutPage` doc with `heading` (string) + `bio` (string array of paragraphs — not Portable Text, since the copy is 3 plain paragraphs) + optional `headshot` (string path, Lightroom workflow). Cross-page fields (coverageArea, bookingStatus, contactEmail) stay on `siteSettings` — one authoritative source per concern.

## Webhook revalidation

`/api/sanity-webhook` receives signed POSTs from Sanity on every publish, verifies the HMAC via `@sanity/webhook@4`'s `isValidSignature` against the raw request body, and invalidates **both** cache layers:

1. Next's Data Cache — `revalidateTag(tag, { expire: 0 })` on the collection tag plus any per-slug tag, so the next render refetches from Sanity.
2. Vercel's edge CDN — `revalidatePath(path)` on each route that renders the changed content, so the next request is a cold miss instead of serving `s-maxage=60` HTML.

Without the path-level call, the webhook returned 200 but the site kept serving stale HTML for up to 60s. Both calls together deliver sub-second end-to-end propagation. `siteSettings` is special-cased to `revalidatePath("/", "layout")` because the root layout reads it on every route.

Signature-verified means an attacker with just the endpoint URL can trigger 401s at worst, never force a revalidation. Unknown `_type` values 400-and-log so a new schema added in Studio without the corresponding handler update surfaces loudly in the Sanity webhook attempt log instead of silently no-op'ing.

## Home-page featured post

A `featured` boolean on `journalPost` surfaces one editorially-curated post in a "Latest story" section on `/` (`src/components/FeaturedJournalPost.tsx`). The section silent-hides when no post is flagged, so an empty `featured` set is a valid steady state. If multiple posts are flagged, the most recently published one wins rather than requiring Julian to hunt down old flags.

Tagged `journalPost` so the webhook's existing `revalidateTag("journalPost")` + `revalidatePath("/")` combo covers it without new wiring.

## Embedded third-party tools

- **`/book`** — Square Appointments embedded from `siteSettings.bookingUrl`. The iframe cannot use `sandbox`; Square detects sandboxed contexts and silently no-ops. A fallback "Open in new tab" button handles browsers that block the embed.
- **`/client`** — Pic-Time gallery portal embedded from `siteSettings.clientGalleryUrl`, same pattern as `/book`.
- **Google Reviews** — `src/components/GoogleReviews.tsx` queries the Places API (New) on `GOOGLE_PLACES_API_KEY` + `GOOGLE_PLACE_ID` (both required), 24h fetch-cache. If unset or the call fails, manual testimonials from `siteSettings.testimonials` take over. If both are empty the component renders `null`.

## Maintenance pass (this cleanup)

- Removed orphaned Sanity-config files (`src/sanity/lib/`, `env.ts`, `structure.ts`, `schemaTypes/`) — zero runtime imports after verification.
- Extracted `cacheSanityFetch<T>()` helper in `src/lib/content.ts` to DRY 6 identical try/catch-to-fallback patterns across the content getters. Pure refactor — same semantics, same fallback values, same `React.cache()` wrapping.
- Normalized inline-comment voice to third-person; stripped implementation-round breadcrumbs.
- Rewrote `README.md` to describe the current shape of the site with new "Architecture notes" + "Scripts" sections.
- Rewrote `sanity/README.md` to collapse per-round sections into a single "Active schemas" table + webhook setup + fresh-clone checklist.
- Consolidated the per-round plan narrative into this CHANGELOG.

## Pending

- Draft previews via `SANITY_API_READ_TOKEN` + Next Draft Mode + Sanity Presentation Tool
- `/journal/tag/[tag]` index pages
- `/journal/rss.xml` feed
- Publish-then-assert Sanity e2e spec (needs test-only token + scratch dataset before it can land without wiring credentials into CI)
- `.ics` calendar attachment on the client inquiry-confirmation email
- Client-facing inquiry status page (backlog #12)
- Submission archive in a durable store (backlog #11) — unlocks follow-on analytics (#13) and SMS-nudge flows (#14)
- Per-venue landing pages once ≥3 repeat shoots cluster at the same venue (backlog #7)
