// Sanity → Next revalidation webhook.
//
// Without this handler, content in Sanity takes up to 60s to appear on the
// site (the `revalidate: 60` on every GROQ fetch in src/sanity/queries.ts).
// With it, publishes in Studio invalidate the relevant Next.js fetch-cache
// tags within the round-trip latency of one HTTP POST — usually <1s.
//
// Next 16 note: `revalidateTag` takes a second argument now. For webhooks
// that need immediate invalidation we pass `{ expire: 0 }` — the
// stale-while-revalidate `"max"` profile is documented as the preferred
// default for Server Actions, but for external-system-driven revalidation
// the docs explicitly recommend `{ expire: 0 }` so the next page request
// is a cold miss rather than serving stale content while the background
// fetch runs.
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

export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
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

  return NextResponse.json({ revalidated: true, tags, now: Date.now() });
}
