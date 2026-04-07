# Sanity CMS — future migration

The site currently reads all content from `src/lib/content.ts`. This folder
stashes Sanity schemas and setup instructions so we can migrate to a real
headless CMS when you're ready, without touching the rest of the app.

## When to migrate

Move to Sanity once you want to edit copy, pricing, portfolio images, and
site settings without touching code. Until then, `src/lib/content.ts` is the
source of truth.

## Setup steps (when ready)

1. Create a free Sanity account at https://sanity.io and create a new
   project. Note the **project ID** and **dataset** (usually `production`).
2. Add these env vars to `.env.local`:

   ```
   NEXT_PUBLIC_SANITY_PROJECT_ID=your_project_id
   NEXT_PUBLIC_SANITY_DATASET=production
   SANITY_API_READ_TOKEN=          # optional, for draft previews
   ```

3. Copy `sanity/schemas/*` into your Sanity Studio project, or embed the
   Studio into this Next.js app at `/studio`:

   - Create `sanity.config.ts` at the repo root
   - Create `src/app/studio/[[...tool]]/page.tsx` exporting the embedded
     `NextStudio` component from `next-sanity/studio`
   - Wire the schema exports from `sanity/schemas/index.ts`

4. Swap `src/lib/content.ts` to fetch from Sanity via `next-sanity`'s
   `sanityFetch` helper. Keep the existing types in `src/lib/types.ts` so
   consuming pages don't change.

5. Seed the initial content by running a one-time import script that reads
   the data in `src/lib/content.ts` and writes it to your Sanity dataset.

## Schema files

The files in `sanity/schemas/` define the document shapes for:

- `siteSettings` — singleton with contact info, booking URL, payment prefs
- `serviceCategory` — services & pricing pages
- `pkg` — embedded package objects (name, price, inclusions)
- `addOn` — embedded add-on objects
- `portfolioCategory` — portfolio galleries
- `galleryImage` — individual portfolio images
- `aboutPage` — singleton About page content

See each file for the exact field definitions.
