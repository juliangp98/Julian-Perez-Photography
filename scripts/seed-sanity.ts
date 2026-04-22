/**
 * Seed (or re-seed) the Sanity dataset with hard-coded content.
 *
 * Prereqs:
 *   - NEXT_PUBLIC_SANITY_PROJECT_ID + NEXT_PUBLIC_SANITY_DATASET in .env.local
 *   - SANITY_API_WRITE_TOKEN in .env.local. Create one at
 *     https://sanity.io/manage → your project → API → Tokens → +Add
 *     with the "Editor" role. Paste into .env.local, run this script,
 *     then delete the token from sanity.io (it's a write credential —
 *     leaving it in a long-lived env file is a foot-gun).
 *
 * Usage:
 *   npm run seed:sanity
 *
 * What it does:
 *   Upserts the full code-owned content graph at stable `_id`s so every
 *   run is idempotent:
 *     - 1 × siteSettings      → _id "siteSettings"
 *     - 1 × aboutPage         → _id "aboutPage"
 *     - 4 × categoryUmbrella  → _id "umbrella-<id>"     (from UMBRELLAS)
 *     - N × serviceCategory   → _id "service-<slug>"    (from services)
 *     - N × portfolioCategory → _id "portfolio-<slug>"  (from portfoliosFallback)
 *   Uses `createOrReplace`, so any existing doc at those ids is REPLACED —
 *   editor-made changes in Studio are overwritten. Run only when you
 *   want the dataset to reflect the hard-coded defaults in the pure-data
 *   modules under `src/lib/`.
 *
 *   Portfolios store metadata only — `coverImage` is a placeholder path
 *   overridden at runtime by src/lib/portfolio-manifest.ts (Lightroom
 *   workflow). Image binaries stay in /public and never
 *   round-trip through Sanity.
 *
 * Why a standalone script and not a Studio "New document" action:
 *   The Studio config hides create/delete for singletons and locked-set
 *   types so editors can't fork or nuke the seeded docs. Seeding is a
 *   developer action — hence `npm run seed:sanity` rather than a button
 *   in Studio.
 *
 * Import hygiene:
 *   Imports come from the pure-data modules (`site-settings-data`,
 *   `services-data`, `types`) rather than `@/lib/content` so tsx doesn't
 *   try to resolve React, Next, or the Sanity runtime client just to
 *   read the fallback objects. Keep those modules import-free.
 */
import { createClient } from "next-sanity";
import { siteSettingsFallback } from "../src/lib/site-settings-data";
import { services } from "../src/lib/services-data";
import { portfoliosFallback } from "../src/lib/portfolios-data";
import { aboutPageFallback } from "../src/lib/about-data";
import { UMBRELLAS } from "../src/lib/types";

const projectId = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID;
const dataset = process.env.NEXT_PUBLIC_SANITY_DATASET || "production";
const token = process.env.SANITY_API_WRITE_TOKEN;

if (!projectId) {
  console.error("✖ NEXT_PUBLIC_SANITY_PROJECT_ID is not set.");
  console.error("  Add it to .env.local and re-run.");
  process.exit(1);
}
if (!token) {
  console.error("✖ SANITY_API_WRITE_TOKEN is not set.");
  console.error(
    "  Create an Editor token at https://sanity.io/manage → your project →",
  );
  console.error(
    "  API → Tokens → +Add, paste into .env.local, re-run, then delete",
  );
  console.error("  the token from sanity.io.");
  process.exit(1);
}

const client = createClient({
  projectId,
  dataset,
  token,
  apiVersion: "2024-05-01",
  // CDN is read-only; writes go to the origin regardless, but being
  // explicit here makes it obvious this client is for mutations.
  useCdn: false,
});

// Remove keys whose value is `undefined` before upserting. Sanity treats
// explicit `undefined` inconsistently depending on the field type, and
// an optional TS field should never land in the dataset as a literal
// null — better to just omit it so the field is "not set."
function omitUndefined<T extends Record<string, unknown>>(obj: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(obj).filter(([, v]) => v !== undefined),
  ) as Partial<T>;
}

async function seedSiteSettings() {
  // Testimonials are an array of objects — Sanity requires a `_key` on
  // each. Index-based keys are fine because `createOrReplace` replaces
  // the whole array every run; there's no incremental diff to preserve.
  const doc = {
    _id: "siteSettings",
    _type: "siteSettings",
    ...siteSettingsFallback,
    testimonials: siteSettingsFallback.testimonials.map((t, i) => ({
      _key: `testimonial-${i}`,
      ...t,
    })),
  };
  const result = await client.createOrReplace(doc);
  console.log(`  ✔ siteSettings (rev: ${result._rev})`);
}

async function seedAboutPage() {
  // Singleton at _id "aboutPage" (matches SINGLETON_IDS in
  // sanity.config.ts). `bio` is a plain string[] — no objects inside,
  // so no `_key` decoration needed. Headshot is optional; strip it if
  // undefined so Sanity doesn't persist a literal null.
  const doc = omitUndefined({
    _id: "aboutPage",
    _type: "aboutPage",
    heading: aboutPageFallback.heading,
    bio: aboutPageFallback.bio,
    headshot: aboutPageFallback.headshot,
  });
  const result = await client.createOrReplace(
    doc as Parameters<typeof client.createOrReplace>[0],
  );
  console.log(`  ✔ aboutPage (rev: ${result._rev})`);
}

async function seedUmbrellas() {
  // UMBRELLAS array order IS the display order — encode it as the `order`
  // field so the Studio rail can sort by it, and editors can drag-sort
  // without renaming ids.
  for (let i = 0; i < UMBRELLAS.length; i++) {
    const u = UMBRELLAS[i];
    const doc = {
      _id: `umbrella-${u.id}`,
      _type: "categoryUmbrella",
      id: u.id,
      title: u.title,
      tagline: u.tagline,
      order: i,
    };
    const result = await client.createOrReplace(doc);
    console.log(`  ✔ umbrella-${u.id} (rev: ${result._rev})`);
  }
}

async function seedServices() {
  for (let i = 0; i < services.length; i++) {
    const s = services[i];
    const doc = omitUndefined({
      _id: `service-${s.slug}`,
      _type: "serviceCategory",
      // Sanity's `slug` field type wraps the string in an object.
      slug: { _type: "slug", current: s.slug },
      title: s.title,
      // Reference to the seeded umbrella doc at `umbrella-<id>`.
      umbrella: {
        _type: "reference",
        _ref: `umbrella-${s.umbrella}`,
      },
      tagline: s.tagline,
      description: s.description,
      // Primitives in an array (strings) don't need explicit _keys — the
      // Sanity client handles that. Objects do (packages, addOns, faqs).
      intro: s.intro,
      comboNote: s.comboNote,
      heroImage: s.heroImage,
      packages: s.packages.map((p, idx) =>
        omitUndefined({
          _key: `pkg-${idx}`,
          _type: "pkg",
          name: p.name,
          tagline: p.tagline,
          price: p.price,
          priceNote: p.priceNote,
          duration: p.duration,
          featured: p.featured,
          group: p.group,
          inclusions: p.inclusions,
        }),
      ),
      addOns: s.addOns?.map((a, idx) =>
        omitUndefined({
          _key: `addon-${idx}`,
          _type: "addOn",
          name: a.name,
          price: a.price,
          description: a.description,
        }),
      ),
      pricingNote: s.pricingNote,
      faqs: s.faqs?.map((f, idx) => ({
        _key: `faq-${idx}`,
        question: f.question,
        answer: f.answer,
      })),
      hidden: s.hidden,
      order: i,
    });
    const result = await client.createOrReplace(
      doc as Parameters<typeof client.createOrReplace>[0],
    );
    console.log(`  ✔ service-${s.slug} (rev: ${result._rev})`);
  }
}

async function seedPortfolios() {
  // Parallel to seedServices: one doc per portfolio entry, stable
  // `_id` at "portfolio-<slug>", array position seeds the `order`
  // field. `images[]` is intentionally NOT seeded — the manifest
  // owns that shape (see src/lib/portfolios-data.ts header comment).
  for (let i = 0; i < portfoliosFallback.length; i++) {
    const p = portfoliosFallback[i];
    const doc = omitUndefined({
      _id: `portfolio-${p.slug}`,
      _type: "portfolioCategory",
      slug: { _type: "slug", current: p.slug },
      title: p.title,
      umbrella: {
        _type: "reference",
        _ref: `umbrella-${p.umbrella}`,
      },
      description: p.description,
      coverImage: p.coverImage,
      hidden: p.hidden,
      order: i,
    });
    const result = await client.createOrReplace(
      doc as Parameters<typeof client.createOrReplace>[0],
    );
    console.log(`  ✔ portfolio-${p.slug} (rev: ${result._rev})`);
  }
}

async function seed() {
  console.log(`→ Seeding to ${projectId}/${dataset}…`);
  console.log("");
  console.log("  Site settings:");
  await seedSiteSettings();
  console.log("");
  console.log("  About page:");
  await seedAboutPage();
  console.log("");
  console.log(`  Umbrellas (${UMBRELLAS.length}):`);
  await seedUmbrellas();
  console.log("");
  console.log(`  Services (${services.length}):`);
  await seedServices();
  console.log("");
  console.log(`  Portfolios (${portfoliosFallback.length}):`);
  await seedPortfolios();
  console.log("");
  console.log(
    `✔ Seed complete — 1 siteSettings + 1 aboutPage + ${UMBRELLAS.length} umbrellas + ${services.length} services + ${portfoliosFallback.length} portfolios.`,
  );
  console.log("  Studio now reflects the seed.");
  console.log(
    "  Reminder: delete SANITY_API_WRITE_TOKEN from .env.local + sanity.io.",
  );
}

seed().catch((err) => {
  console.error("✖ Seed failed:", err);
  process.exit(1);
});
