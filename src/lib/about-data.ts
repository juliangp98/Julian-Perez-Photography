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
    "My name is Julian Perez and I'm a 2021 graduate of Northeastern University, with a Computer Engineering degree and a Photography Minor. At the start of my photography adventure, I was entirely self-taught in regard to both photo-taking and post-processing techniques. My interest in photography slowly developed over several years from a novelty hobby out of boredom on my old iPhone 4 to a genuine passion using my Canon Rebel T3i and film cameras. I would mainly focus on travel photography and landscapes, and I always became the designated photographer for family events.",
    "As I took on more work and upgraded to professional equipment, I have continued expanding my horizons and exploring the human connection as a photographer for weddings and engagements, events, portraits and headshots, and photojournalism. I've also started delving into video work! As I continue to expand my capabilities, I have consistently challenged myself to change my mindset and use new tools to accomplish something unique for each project — something I feel is a crucial skill to be able to satisfy every client's unique needs while retaining the signature style I have developed over the years.",
    "For details about my services and pricing, please feel free to reach me using the contact page. I mainly work in the Arlington, VA / Washington, DC / Maryland area but can travel as needed.",
  ],
};
