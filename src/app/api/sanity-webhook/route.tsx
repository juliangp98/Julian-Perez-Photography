// Sanity → Next revalidation webhook.
//
// Without this handler, content in Sanity takes up to 60s to appear on the
// site — not because of one cache layer but TWO:
//   1. Next's Data Cache — `revalidate: 60` on every GROQ fetch in
//      src/sanity/queries.ts, keyed by tag.
//   2. Vercel's CDN cache — `s-maxage=60` applied to rendered HTML at the
//      edge. This is the `Revalidate: 1m` column in `next build` output.
// With this handler, publishes in Studio invalidate BOTH layers in the
// round-trip latency of one HTTP POST — usually <1s.
//
// The reason both calls matter: `revalidateTag` only busts layer 1. A page
// whose HTML is already in Vercel's edge cache keeps serving the stale
// HTML until layer 2's TTL expires, even though the next cold render
// WOULD fetch fresh data. That produced the "webhook returns 200, site
// still stale for 60s" symptom we hit in staging. `revalidatePath` busts
// BOTH the router cache and the edge cache, so the next request to the
// affected route is a cold miss that re-renders + repopulates both layers.
//
// Next 16 note: `revalidateTag` takes a second argument now. For webhooks
// that need immediate invalidation we pass `{ expire: 0 }` — the
// stale-while-revalidate `"max"` profile is documented as the preferred
// default for Server Actions, but for external-system-driven revalidation
// the docs explicitly recommend `{ expire: 0 }` so the next page request
// is a cold miss rather than serving stale content while the background
// fetch runs. `revalidatePath(path, type?)` signature is unchanged in 16.
//
// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------
// 1. Generate a secret:  `openssl rand -hex 32`
// 2. Add `SANITY_WEBHOOK_SECRET=<value>` to:
//      - .env.local (for `npm run dev` + ngrok testing)
//      - the production deploy env (Vercel → Project → Settings → Env Vars)
// 3. In Sanity manage (https://sanity.io/manage → project → API → Webhooks),
//    create a webhook with:
//      - Name:        Next.js revalidation
//      - URL:         https://julianperezphotography.com/api/sanity-webhook
//      - Dataset:     production
//      - Trigger:     Create + Update + Delete
//      - Filter:      _type in [
//                       "siteSettings", "aboutPage", "categoryUmbrella",
//                       "serviceCategory", "portfolioCategory", "journalPost"
//                     ]
//      - Projection:  { _id, _type, "slug": slug.current }
//      - HTTP method: POST
//      - API version: v2024-05-01
//      - Secret:      (the value from step 1)
//
// ---------------------------------------------------------------------------
// Security
// ---------------------------------------------------------------------------
// Every request is signature-verified via `@sanity/webhook`'s `isValidSignature`.
// An attacker with the endpoint URL but without the secret can't force
// revalidation of arbitrary tags — the worst they can do is trigger 401s.
// `revalidateTag` itself is idempotent + a no-op for tags nothing is keyed
// on, so even a valid-but-spurious type (someone adds a new schema to
// Sanity before we update the allowlist below) falls through harmlessly.
//
// ---------------------------------------------------------------------------
// Tag strategy — keep in sync with src/sanity/queries.ts
// ---------------------------------------------------------------------------
// Every GROQ fetch in queries.ts tags its result with the doc-type name:
//   - siteSettings     → ["siteSettings"]
//   - aboutPage        → ["aboutPage"]
//   - categoryUmbrella → ["categoryUmbrella"]
//   - serviceCategory  → ["serviceCategory"]                (catalog reads)
//                      + ["serviceCategory:<slug>"]         (detail reads)
//   - portfolioCategory→ ["portfolioCategory"]              (catalog reads)
//                      + ["portfolioCategory:<slug>"]       (detail reads)
//   - journalPost      → ["journalPost"]                    (index reads)
//                      + ["journalPost:<slug>"]             (detail reads)
//
// On publish we revalidate the collection tag unconditionally, plus the
// per-slug tag when the doc type has one. That way editing one service
// busts `/services` (catalog consumers) AND `/services/<slug>` (detail)
// without bothering the other 15 service detail pages.
//
// ---------------------------------------------------------------------------
// Path strategy — edge-cache purge
// ---------------------------------------------------------------------------
// Hand-maintained map of doc-type → routes that render that content. Kept
// tight (a serviceCategory edit doesn't purge `/journal`) so one publish
// doesn't cold-start the entire site. Route-to-query mapping:
//   - siteSettings     → every page (nav + footer) — handled by
//                        `revalidatePath("/", "layout")`, which invalidates
//                        every route under the root layout in one call.
//   - aboutPage        → `/about`
//   - categoryUmbrella → `/`, `/services`, `/portfolio`, `/questionnaire`,
//                        `/sitemap.xml`
//   - serviceCategory  → `/`, `/services`, `/questionnaire`, `/sitemap.xml`,
//                        + `/services/<slug>`, `/questionnaire/<slug>`
//   - portfolioCategory→ `/`, `/portfolio`, `/sitemap.xml`,
//                        + `/portfolio/<slug>`
//   - journalPost      → `/journal`, `/sitemap.xml`, + `/journal/<slug>`
//
// When you add a new schema or surface existing content on a new route,
// update BOTH this map AND the tag strategy above, then ship. The e2e
// suite exercises the routes but not the revalidation path — missing an
// entry here surfaces as "content updates stay stale for 60s", not a test
// failure.

export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { revalidatePath, revalidateTag } from "next/cache";
import { isValidSignature, SIGNATURE_HEADER_NAME } from "@sanity/webhook";

// Doc types we accept for revalidation — mirrors the filter we set on the
// Sanity side but also acts as a defensive allowlist: a typo in the Sanity
// filter (or a new schema that hasn't been wired up here yet) shows up as
// a 400 in the Sanity webhook log rather than silently no-op'ing.
const KNOWN_TYPES = new Set([
  "siteSettings",
  "aboutPage",
  "categoryUmbrella",
  "serviceCategory",
  "portfolioCategory",
  "journalPost",
]);

// Subset of the above whose queries in src/sanity/queries.ts ALSO tag a
// per-slug cache entry (`<type>:<slug>`). Singletons + locked-sets don't
// have a detail page, so no per-slug tag exists.
const PER_SLUG_TYPES = new Set([
  "serviceCategory",
  "portfolioCategory",
  "journalPost",
]);

// Rendered routes affected by each doc type. See the "Path strategy" block
// in the header for the reasoning. siteSettings is deliberately absent —
// it's handled separately via layout-level revalidation because it
// participates in every route's render through the root layout.
function pathsForType(type: string, slug?: string): string[] {
  switch (type) {
    case "aboutPage":
      return ["/about"];
    case "categoryUmbrella":
      return [
        "/",
        "/services",
        "/portfolio",
        "/questionnaire",
        "/sitemap.xml",
      ];
    case "serviceCategory":
      return [
        "/",
        "/services",
        "/questionnaire",
        "/sitemap.xml",
        ...(slug
          ? [`/services/${slug}`, `/questionnaire/${slug}`]
          : []),
      ];
    case "portfolioCategory":
      return [
        "/",
        "/portfolio",
        "/sitemap.xml",
        ...(slug ? [`/portfolio/${slug}`] : []),
      ];
    case "journalPost":
      return [
        "/journal",
        "/sitemap.xml",
        ...(slug ? [`/journal/${slug}`] : []),
      ];
    default:
      return [];
  }
}

type WebhookPayload = {
  _id?: string;
  _type?: string;
  // Projected via `"slug": slug.current` in the Sanity webhook config —
  // flat string, not the nested `{_type: "slug", current: string}` shape.
  slug?: string;
};

export async function POST(req: Request) {
  const secret = process.env.SANITY_WEBHOOK_SECRET;
  if (!secret) {
    // Deploy misconfigured. Return 500 so Sanity's retry logic + the
    // webhook attempt log both surface this loudly.
    return NextResponse.json(
      { error: "SANITY_WEBHOOK_SECRET is not configured on the server." },
      { status: 500 },
    );
  }

  const signature = req.headers.get(SIGNATURE_HEADER_NAME);
  if (!signature) {
    return NextResponse.json(
      { error: "Missing signature header." },
      { status: 401 },
    );
  }

  // Read the body as raw text BEFORE parsing. HMAC verification has to run
  // against the exact bytes Sanity signed — re-encoding through
  // JSON.parse + JSON.stringify can drop whitespace or reorder keys and
  // invalidate the signature.
  const rawBody = await req.text();

  const valid = await isValidSignature(rawBody, signature, secret);
  if (!valid) {
    return NextResponse.json(
      { error: "Invalid signature." },
      { status: 401 },
    );
  }

  let body: WebhookPayload;
  try {
    body = JSON.parse(rawBody) as WebhookPayload;
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body." },
      { status: 400 },
    );
  }

  const { _type, slug } = body;
  if (!_type || typeof _type !== "string") {
    return NextResponse.json(
      { error: "Missing or invalid `_type` in payload." },
      { status: 400 },
    );
  }

  if (!KNOWN_TYPES.has(_type)) {
    // Loud failure on a type we don't know how to revalidate. Most likely
    // cause: a new schema landed in Studio without the corresponding
    // handler + queries.ts update. Log so Vercel runtime logs surface it.
    console.warn(
      `[sanity-webhook] Received unknown _type "${_type}" — add it to KNOWN_TYPES or remove it from the Sanity webhook filter.`,
    );
    return NextResponse.json(
      { error: `Unknown _type: ${_type}` },
      { status: 400 },
    );
  }

  // Collection tag always. Per-slug tag only when the type has one AND
  // the projection included a slug — singletons/locked-sets have no slug
  // so `slug` comes through as null/undefined for those, which is fine.
  const tags: string[] = [_type];
  if (typeof slug === "string" && slug.length > 0 && PER_SLUG_TYPES.has(_type)) {
    tags.push(`${_type}:${slug}`);
  }

  // `{ expire: 0 }` = immediate expiration. Next-request-to-the-page is a
  // cold miss that refetches from Sanity. See the header comment for why
  // this is the right profile for an external webhook (vs. the "max" /
  // stale-while-revalidate default used in Server Actions).
  for (const tag of tags) {
    revalidateTag(tag, { expire: 0 });
  }

  // Path-level revalidation busts the layer `revalidateTag` can't reach:
  // Vercel's CDN cache on rendered HTML (`s-maxage=60`). Without this the
  // webhook returns 200 but the site keeps serving the cached HTML until
  // Vercel's own TTL expires. See the header comment "two-layer cache
  // model" for the full explanation.
  //
  // siteSettings is special-cased: it's consumed in the root layout (nav
  // + footer + contact info), so there's no short list of pages to purge.
  // `revalidatePath("/", "layout")` invalidates every route under the
  // root layout in one call — heavier than a targeted purge, but correct.
  const paths = pathsForType(_type, slug);
  for (const path of paths) {
    revalidatePath(path);
  }
  const revalidatedLayout = _type === "siteSettings";
  if (revalidatedLayout) {
    revalidatePath("/", "layout");
  }

  return NextResponse.json({
    revalidated: true,
    tags,
    // Echo what we actually purged so the Sanity webhook attempt log is
    // useful for debugging stale-content reports ("which tag/path did you
    // expect to invalidate?"). The layout sentinel is a string, not a
    // path, so it's obvious what happened when reading the log.
    paths: revalidatedLayout ? ["layout:/"] : paths,
    now: Date.now(),
  });
}
