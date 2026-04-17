// Shared Sanity read client. Marketing pages (currently just /journal, more
// coming in round 14) fetch through this so caching + API version stay uniform.
//
// `useCdn: true` is correct for us even though we want fresh content: Next's
// `fetch` layer holds the real freshness contract via `next: { revalidate }`
// / `tags`, so the Sanity CDN is just a low-latency origin. Bypassing it only
// buys us stale-reads-under-network-hiccup without any benefit.
//
// Why the placeholder projectId: `createClient({ projectId: "" })` throws
// synchronously ("Configuration must contain `projectId`"), which breaks the
// production build on fresh clones where env isn't set yet. Passing a
// sentinel string keeps the client constructible, and every fetch path
// gates on `isSanityConfigured()` before doing anything network-bound — so
// the placeholder never leaks into an actual request. (An earlier version
// used a lazy Proxy; @sanity/image-url reads projectId/dataset in a way
// that didn't go through the Proxy, producing `cdn.sanity.io/images/undefined/undefined/...`
// URLs. Eager construction with a placeholder sidesteps that entirely.)
//
// Draft-mode / preview token is deliberately NOT wired in this round — see the
// round-13 plan at ~/.claude/plans/splendid-frolicking-journal.md ("Out of
// scope"). When preview lands we'll create a second client here that takes
// `perspective: 'previewDrafts'` + `token`.

import { createClient } from "next-sanity";

// apiVersion pinned to the date this round shipped so responses are stable
// even if Sanity evolves defaults later. Bump intentionally, not on autopilot.
const API_VERSION = "2024-05-01";

// Valid-shaped but obviously-not-real projectId used only when env is unset.
// Never reaches the wire because of the `isSanityConfigured()` gates.
const PLACEHOLDER_PROJECT_ID = "placeholder";

export const sanityClient = createClient({
  projectId: process.env.NEXT_PUBLIC_SANITY_PROJECT_ID || PLACEHOLDER_PROJECT_ID,
  dataset: process.env.NEXT_PUBLIC_SANITY_DATASET || "production",
  apiVersion: API_VERSION,
  useCdn: true,
});

// Single truth for "do we have enough env to actually call Sanity?". The
// journal pages consult this before fetching so a fresh clone without env
// still builds + renders a graceful placeholder instead of throwing. Same
// pattern we use for Resend/Twilio in src/lib/mail.ts + src/lib/sms.ts.
export function isSanityConfigured(): boolean {
  return !!process.env.NEXT_PUBLIC_SANITY_PROJECT_ID;
}
