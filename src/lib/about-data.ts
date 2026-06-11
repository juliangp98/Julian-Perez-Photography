// Pure-data module: exports the hard-coded `aboutPageFallback` object
// (heading + bio paragraphs + optional headshot) with zero runtime
// imports beyond types. Isolation matters because the seed script
// (`scripts/seed-sanity.ts`) imports from here under `tsx` without
// pulling React, Next, or the Sanity client into scope.
//
// Everyday call sites keep importing from `@/lib/content` (it re-exports
// `aboutPageFallback` from here) — only the seed script reaches into
// this file directly.
//
// Dual role, same as `siteSettingsFallback` and `portfoliosFallback`:
//   1. **Fallback** — `getAboutPage()` in content.ts merges remote
//      Sanity values on top of this object per-field so a partial doc
//      still renders.
//   2. **Seed source** — `scripts/seed-sanity.ts` upserts this object
//      to the dataset at `_id: "aboutPage"` on every run.
//
// Keep the shape in lockstep with `AboutPage` in ./types.ts AND the
// Sanity schema at `sanity/schemas/aboutPage.ts`.

import type { AboutPage } from "./types";

export const aboutPageFallback: AboutPage = {
  heading: "Hi, I'm Julian.",
  bio: [
    "Photography grabbed me as a teenager and never let go. It started with an iPhone 4 and pure curiosity, then a borrowed Canon T3i on family trips to the Caribbean and Europe. Those trips became my sandbox for landscapes and architecture. By the time I reached Northeastern for computer engineering, the pull was strong enough that I added a photography minor and spent my first co-op paycheck on my first professional camera.",
    "The turning point was three weeks studying abroad in Cuba in 2019. That's where years of practice with composition and color theory finally met the missing piece: storytelling. I came home, photographed my first wedding, and knew exactly what I wanted to build.",
    "After graduating in 2021 I moved to Arlington, VA and started over in a brand-new market, building my DMV practice client by client, referral by referral. Today it spans weddings and engagements, portraits and headshots, events, maternity, and full wedding films I shoot and edit myself. The films are my most difficult challenge yet, and the most rewarding.",
    "My favorite frames are almost never the posed ones. They happen when a couple walks side by side, whispers something, makes each other laugh, and my job is to be ready for that. I never want to feel like I'm just pressing a button, and I never want a client to feel like a transaction: every person I work with should feel like a friend with my full attention.",
    "I'm based in Arlington, VA and work across DC, Maryland, and Northern Virginia, with travel happily on the table. For services and pricing, the services page has every detail, or just reach out.",
  ],
};
