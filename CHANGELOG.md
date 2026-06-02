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
- Conditional `showIf` branches hide/show follow-up fields; the server validates against the same schema so anything hidden on the client is also optional on the server. `showIf` matches against checkbox (array) values by membership, which lets a checked option reveal its own follow-up fields — the wedding questionnaire's "Vendors & coordination" section uses this so checking a vendor type opens a contact box for it.
- The wedding questionnaire captures photography style preference (with an "Other" free-text branch), engagement-session preferences (shown only for packages that include one), an outdoor-ceremony weather-backup plan, vendor contacts by type, and photo-sharing consent (full / none / per-channel-and-type partial).
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

## Wedding films service

A second wedding offering at `/services/wedding-films`, sibling to the existing `/services/weddings` photo service. Hybrid coverage (photo + video) decided per booking — Julian leads whichever craft is the centerpiece of the day, partner crew covers the other side. Three tier groups split via the `pkg.group` field rendered as labeled sub-sections on the service page:

- **Hybrid Photo + Video tiers** — Documentary, Story Film, Cinematic, Signature Film. Prices are additive ("+$X added to your photo package") on top of whichever photo tier the couple picks. Single contract, single point of contact.
- **Solo tiers** — Solo Ceremony Film, Solo Hybrid, Solo Story Film. Standalone offerings for couples who want only video coverage from Julian, or who want a single shooter who can switch into photography after the ceremony.
- **A la carte** — raw footage, social teaser, live-stream, extra hour, extra videographer, engagement b-roll, additional revision rounds.

`pkg.crewSize` renders as a small caption under each tier (e.g. "Julian + 1 partner"); `pkg.honestyNote` renders as a visually distinct disclosure block beneath the inclusions list — used on Solo Hybrid to name the 10–15 minute gear-switch coverage gap couples accept in exchange for the lower price.

Editor model is Sanity-first with a code-side fallback: video entries are added through Studio (with `npm run upload-video` for music-blocked films that can't live on YouTube), and the hard-coded `services-data.ts` / `portfolios-data.ts` arrays serve both as the seed source and as the all-or-nothing fallback when Sanity is unreachable.

## Wedding films portfolio

Browsable archive at `/portfolio/wedding-films` rendering a video grid + lightbox. Each entry is a `videoEntry` sub-document on the parent `portfolioCategory` with a discriminated `source` union: YouTube embeds (auto-thumbnailed from `i.ytimg.com/vi/<id>/maxresdefault.jpg`) or self-hosted Vercel Blob videos (manual thumbnail at `/public/portfolio/wedding-films/thumbnails/<slug>.jpg`). The grid groups by featured-then-manual-order-then-date-descending; the featured entry spans 2×2 as a hero tile.

Lightbox is `yet-another-react-lightbox`'s built-in Video plugin for HTML5 playback plus a custom `render.slide` for YouTube iframes via `youtube-nocookie.com`. The `videoEntry` schema includes conditional Studio fields — picking "YouTube" hides the Blob URL field and vice versa — so editors only see the relevant input.

A `FeaturedReel` component pulls the same `featured: true` entry onto `/services/wedding-films` as a hero block above the tier grid, reusing the same lightbox shell so the playback experience is identical between the service and portfolio surfaces.

CSP additions (Report-Only): `frame-src` += `youtube-nocookie.com` and `youtube.com`, new `media-src 'self' https://*.blob.vercel-storage.com` (governs `<video>` sources, doesn't fall back to default-src), `img-src` += `i.ytimg.com`. `next/image` `remotePatterns` likewise extended for `i.ytimg.com`.

A YouTube ID normalizer in both `VideoGallery` and `FeaturedReel` accepts either a bare 11-char ID or any of the common pasted URL forms (watch, share, embed, shorts) so a quick paste from the address bar works without intermediate parsing.

Visible FAQ accordion added to every service page — the existing `FAQPage` JSON-LD was emitted but had no on-page counterpart, which Google's rich-results guidelines technically require. Native `<details>`/`<summary>` for keyboard + screen-reader accessibility without a JS dependency.

## Vercel Blob upload helper

`npm run upload-video -- ./path/to/film.mp4` (`scripts/upload-video.ts`) pushes a local file to Vercel Blob with `access: "public"` and prints the URL ready for pasting into Studio. Uses the existing `BLOB_READ_WRITE_TOKEN` (same one already powering questionnaire uploads) — the token is safe to leave permanently in `.env.local`. Used for music-blocked films that YouTube would mute or block; YouTube-hosted entries don't need the script.

## Wedding films planning questionnaire

A 16-section schema-driven planning questionnaire at `/questionnaire/wedding-films`, parallel to the existing weddings questionnaire and tailored to video-specific concerns: lead-role preference (photo-led vs. video-led), ceremony type and expected length, audio setup (lav mic availability, DJ board feed, live-band considerations), drone permissions at the venue, reception structure (speakers + dance order), pre-wedding interview prep prompts, music selections + tone keywords, engagement-session b-roll capture, live-stream coverage, sharing intent, and vendor coordination. Conditional `showIf` clauses scope sections by tier — drone questions appear only on Cinematic/Signature, interview-prep prompts on Story Film/Cinematic/Signature, the engagement-b-roll block on Story Film/Cinematic.

The service-page CTA at `/services/wedding-films` ("Start the questionnaire →") auto-surfaces once the questionnaire is registered — no service-page change was required.

## Wedding Films Plan PDF

A `/api/wedding-films-plan` route mirrors `/api/wedding-plan` for the wedding-films questionnaire: same rate-limit + honeypot + required-field validation gates, same `apiError` envelope shape, same try/catch around `renderToBuffer`. The PDF document component (`src/lib/wedding-films-plan.tsx`) renders coverage overview + ceremony details + audio checklist + reception structure + interview prep + music/tone + sharing intent + vendor coordination, with conditional sections for drone (Cinematic/Signature only) and interviews (Story Film and up).

The `QuestionnaireForm` component now picks the route + filename + label from a slug-keyed `PDF_PLANS` table instead of hard-coding `/api/wedding-plan` — adding a third PDF in the future is a one-line append plus a new route + component pair.

## Cross-questionnaire prefill (hybrid bookings)

Couples booking hybrid coverage (photo + video) ideally fill both `/questionnaire/weddings` and `/questionnaire/wedding-films`. The success screen on either now surfaces a "Continue planning the {other} side →" button that constructs a URL with the shared field values (`fullName`, `email`, `phone`, `instagram`, `partnerFullName`, `partnerPronouns`, `bookingStatus`, `eventDate`) URL-encoded as query params. The receiving form's existing prefill mechanism consumes those params automatically — no schema or component change to the receiving side. Tier and venue-specific fields intentionally don't propagate; the photo and video tier names diverge, and venue addresses live under different field IDs across the two forms.

## Observability (Sentry)

`@sentry/nextjs` is wired into the project per the upstream SDK's recommended layout. Four entry-points cover every runtime: `instrumentation.ts` at the project root dispatches to the server / edge configs through Next's `register()` hook and exports `onRequestError = Sentry.captureRequestError` so React Server Component + route-handler failures land in Sentry without per-route boilerplate; `instrumentation-client.ts` initializes the browser SDK and exports `onRouterTransitionStart = Sentry.captureRouterTransitionStart` so App Router navigations show up as performance spans; `sentry.server.config.ts` and `sentry.edge.config.ts` carry the runtime-specific `Sentry.init` calls. All four are no-ops when `NEXT_PUBLIC_SENTRY_DSN` (or the server-side `SENTRY_DSN`) is unset, so local dev without a DSN runs unchanged.

`next.config.ts` is wrapped in `withSentryConfig` for build-time source-map upload (gated on `SENTRY_AUTH_TOKEN` so non-CI builds skip the upload step; `widenClientFileUpload: true` covers dynamic-import chunks; maps are deleted from the deploy output after upload to defend against bundle leakage) and a same-origin tunnel route (`/monitoring/sentry`) that bypasses ad-blocker drops on client-side error reporting.

Browser-side Session Replay is enabled at 10% ambient capture + 100% on-error capture, with `maskAllText` / `maskAllInputs` / `blockAllMedia` pinned explicitly so the questionnaire / inquiry forms' real client PII can't end up in recorded sessions. Server config has `includeLocalVariables: true` (variable values attached to stack frames for diagnosis without a repro) and `enableLogs: true` (activates Sentry's Logs product alongside captured exceptions).

`Sentry.captureException` calls land inside every existing API-route catch block (inquire, questionnaire, wedding-plan, wedding-films-plan, questionnaire-upload) plus the App Router error boundaries (`error.tsx`, `global-error.tsx`). Each call carries `tags: { route, stage }` so events group cleanly in the Sentry dashboard. Fire-and-forget side-effects (SMS, client confirmations) capture at `level: "warning"` to keep the primary failure dashboard signal-heavy.

A `beforeSend` hook strips request body / headers / cookies from every captured event before send, leaving only the URL and method — questionnaire and inquiry payloads carry real client PII that should never leave the project's own infrastructure.

CSP additions: `connect-src` += `*.sentry.io` + `*.ingest.sentry.io` (defensive; the same-origin tunnel route is the primary path), new `worker-src 'self' blob:` directive (Sentry's profiling features use Web Workers).

A new `# Test + observability discipline` section in `AGENTS.md` codifies the standing requirement: every round of work that ships new code paths updates a smoke-level e2e test and adds Sentry instrumentation alongside the code.

## Client records & CRM

Inquiries and questionnaire submissions are now captured as durable **client records** (closing the long-standing submission-archive gap) in a free, **private Supabase Postgres** table (`client_records`). Sanity isn't used for this: client records carry PII, a private store is required, and Sanity's private datasets are a paid feature — a free Postgres table keeps the data private at no cost. Julian manages records in the owner dashboard at `/admin` (see "Owner admin dashboard"); the Supabase Table Editor remains available for complex JSONB edits.

The app reaches the table only through `src/lib/clients.ts` (server-only, Supabase service-role key). Reads use two projections: the full row for admin/server reads and `SAFE_SELECT` for the portal, which omits `internal_notes`, the questionnaire snapshot, status history, and inquiry context at the query layer so they can never reach a client. Row-Level Security is enabled on the table; the service role bypasses it server-side and nothing else can read it. The canonical pipeline statuses live in a dependency-free `src/lib/client-status.ts` shared by the helpers and the portal. Array fields (locations, dates, documents, status history) are JSONB columns.

**One row is one project; the email identifies the person.** The email column is non-unique, so a single client can own several projects at once — an engagement and a wedding, a maternity and a newborn session, or unrelated shoots. Projects that belong together share a `bundle_id` with a denormalized `bundle_label` (see "Project bundles"). Helpers resolve a person's projects by email (`listProjectsByEmail`, `getProjectForEmail`) and gate every read/write on ownership.

The read layer tolerates schema drift: if a deploy lands before the bundle columns are added, the first projection that asks for them catches PostgREST's undefined-column error (SQLSTATE 42703), drops the bundle columns for the rest of the process, and retries — so the portal and admin keep serving (without bundle grouping) instead of returning a 500. An unrelated error is matched out and still surfaces. Applying the migration and restarting restores bundles.

Capture is fire-and-forget and **no-ops when the store isn't configured**, so the email flow is untouched on a deploy without the Supabase env. `/api/inquire` upserts a record (matched by normalized email **+ service type**, so a second service for the same person opens a second project instead of overwriting the first; status `new-inquiry`; never clobbers an advanced record). `/api/questionnaire` snapshots the answers onto the matching project (email + service), stores the generated plan PDF to Vercel Blob (`src/lib/blob.ts`), links it as a document, and advances status toward `planning` without regressing a further-along record.

## Client portal

A passwordless client portal at `/portal`. Magic-link auth via `jose`: `/api/portal/request-link` emails a one-time signed token (20-min TTL) through Resend with a uniform, rate-limited, anti-enumeration response; `/portal/verify` validates it, confirms at least one project exists for the email, and sets an httpOnly/Secure/SameSite session cookie carrying the **email** (the person), not a single record id. The gate is a Next.js 16 **Proxy** (`src/proxy.ts`, Node.js runtime) that protects `/portal/*` except the login + verify routes — running on the same runtime as the page renderers keeps cookie handling consistent across full-page loads and client-side navigations. Token + session signing share `AUTH_SECRET`; the pure `jose` sign/verify helpers live in `auth.ts` (used by both the proxy and the route handlers), while the `next/headers` cookie read/write helpers live in `auth-cookies.ts`.

The portal opens to a **menu of the signed-in person's projects** — styled like the services / galleries index, with cards grouped under Julian's photographic umbrellas and bundled projects pulled into their own accent-bordered group. `/portal/projects/[id]` then renders one project's detail via the `SAFE_SELECT` projection: friendly status label, dates, locations, plan, package/service, and document download links. Every project is resolved by **(project id + session email)** — a URL naming someone else's project returns not-found, so listing and linking can never reach across people (no IDOR). On a project, clients can make **limited edits** (`/api/portal/update` — a zod-whitelisted set: phone, partner name, guest count, notes) and **upload documents** (`/api/portal/upload` issues a session-gated Blob token; `/api/portal/attach-document` links the upload to that project with `uploadedBy: "client"`); both carry the `projectId` and re-check ownership server-side. Julian is emailed on client edits. All portal routes are Sentry-instrumented; `/portal` is disallowed in `robots.ts`.

Each project's detail view also surfaces a **prefilled link into the matching planning questionnaire** (`getQuestionnaire(serviceType)`), carrying over name/email/phone/partner/date/guests — so a client who only inquired can flow into the full questionnaire, which attaches back to the same project (matched by email + service) and populates it further. Portal links are surfaced at every relevant touchpoint: the inquiry and questionnaire thank-you panels, the footer's "For clients" list, and the `/client` galleries page.

## Owner admin dashboard

An owner-only dashboard at `/admin`, gated by a magic link to `ADMIN_EMAIL` (the same `jose` mechanism as the client portal, with a separate session cookie + purpose; the allowlist is re-checked on every verify, so dropping an address revokes access even on an unexpired token). The Proxy (`src/proxy.ts`) gates `/admin/*` alongside `/portal/*`. The login form is shared with the portal (`PortalLoginForm`, parameterized by endpoint).

`/admin/projects` is a status-grouped overview of every client record (cards laid out like the services/galleries pages — New inquiries / Active / Delivered / Archived, each card showing a bundle badge when the project is linked), and `/admin/projects/[id]` is a full read/edit view: a form for the scalar fields + status dropdown + internal notes (writing through `/api/admin/update`, which appends a status-history entry on status changes), a **bundle control** that links or unlinks this client's related projects (shown when the person has two or more, writing through `/api/admin/bundle`), plus read-only context (locations, dates, documents, status history, the raw questionnaire snapshot). This replaces the Supabase Table Editor for day-to-day management; the table editor remains for complex JSONB edits. `/admin/links` is a categorized hub of every external service the site depends on (Vercel, Sanity manage + Studio, Supabase, Resend, Twilio, Google Cloud, Square, Pic-Time, Sentry, GitHub, Search Console, and more). Admin reads use the full row; `listClients` / `getClientFull` / `updateClientAdmin` live alongside the client helpers in `src/lib/clients.ts`. `/admin` is disallowed in `robots.ts`.

## Project bundles

Two or more of one person's projects can be linked into a **bundle** — a wedding and its engagement session, a maternity and newborn pairing, or any grouping Julian sets up. A bundle is a shared `bundle_id` across the linked rows plus a denormalized `bundle_label` (the display name), so the relationship reads from any one project without a join. Both sides can manage it: the client links their own projects from the portal menu (`PortalBundles` → `/api/portal/bundle`), and Julian links a client's projects from the admin project page (the same component, pointed at `/api/admin/bundle`). The two write paths share one invariant — a bundle can never span two people. The client path drops any project id the signed-in email doesn't own; the admin path requires every selected project to resolve to a single email. Linking needs two or more projects and a label; unlinking clears the pair on one project.

The link is **visible by text, color, and grouping**. On the portal menu, bundled projects leave the per-category grid and render together in their own accent-bordered block headed by the `↔` glyph, the bundle label, and a "Bundle" tag; their cards carry an accent border. On both admin surfaces — the projects overview and the project detail page — a linked project shows an `↔ {label}` badge. The interface matches the rest of the site: the same card shells, accent variables, and serif headings as the services / galleries menus.

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
- Publish-then-assert Sanity e2e spec (needs test-only token + scratch dataset before it can land without wiring credentials into CI) — would also cover the end-to-end client-capture + magic-link happy path
- `.ics` calendar attachment on the client inquiry-confirmation email
- Automated status-change notifications to clients (e.g. "You're booked!") now that the pipeline is in place
- Follow-on analytics (#13) + SMS-nudge flows (#14), now unblocked by the durable client store
- Per-venue landing pages once ≥3 repeat shoots cluster at the same venue (#7)
