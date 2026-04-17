# Sanity CMS — migration status

Sanity is now partially live. The embedded Studio at `/studio` is wired and
the `journalPost` schema is the only active type in `sanity.config.ts`.
Everything else in this folder is written but dormant, waiting on round 14.

## Status

| Schema | Status | Where it renders |
| --- | --- | --- |
| `journalPost` | **Active** (round 13) | `/journal` index + `/journal/[slug]` detail |
| `siteSettings` | Dormant | Still reads from `src/lib/content.ts` |
| `serviceCategory` + `pkg` + `addOn` | Dormant | Still reads from `src/lib/content.ts` |
| `portfolioCategory` + `galleryImage` | Dormant | Still reads from `src/lib/content.ts` + `portfolio-manifest.ts` |
| `aboutPage` | Dormant | Still reads from `src/lib/content.ts` |

Dormant schemas are **not** registered in `sanity.config.ts` on purpose —
exposing them in Studio would invite edits that don't show up on the site.
They'll be turned on in round 14 along with the rendering changes.

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

## Round 14 (next) — wire the dormant schemas

Plan:

1. Register the dormant schemas in `sanity.config.ts` so they appear in Studio.
2. Write GROQ queries in `src/sanity/queries.ts` for `siteSettings`,
   `serviceCategory` (+ `pkg`, `addOn`), `portfolioCategory` (+ `galleryImage`),
   and `aboutPage`.
3. Replace the exports in `src/lib/content.ts` with Sanity-backed fetches.
   Keep the existing TypeScript types in `src/lib/types.ts` so consuming
   pages (services, portfolio, about, home) don't need structural changes.
4. Write a one-time seed script that reads the current `content.ts` and
   upserts documents into Sanity so Julian doesn't have to retype anything.
5. Add a webhook → `/api/sanity-webhook` → `revalidateTag` so publish flips
   the site within a second or two (drop the 60s TTL dependence).

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
- `siteSettings.ts` — dormant; becomes the source of truth for contact info, booking URL, payment prefs
- `serviceCategory.ts` — dormant; powers services & pricing pages (includes `pkg` + `addOn` inline)
- `portfolioCategory.ts` — dormant; powers portfolio galleries (includes `galleryImage` inline)
- `aboutPage.ts` — dormant; powers the About page

See each file for the exact field definitions.
