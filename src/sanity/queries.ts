// GROQ queries for journal content. Two things worth noting:
//
// 1. LQIP + dimensions are projected INLINE via `asset->{ url, metadata { lqip, dimensions } }`
//    so the callsite gets everything it needs to render a blur placeholder and
//    set explicit width/height on <Image>. Without this, Next.js would
//    request intrinsic sizes client-side (layout shift) and we'd have no
//    base64 for `blurDataURL`.
//
// 2. Every query passes `next: { revalidate: 60, tags: [...] }` to Next's
//    fetch. 60s is a decent compromise: Julian's journal is not a news site,
//    publishing rhythms are measured in days; a minute's lag between "I
//    published" and "it's on the site" is acceptable. When we wire the
//    webhook (round 14+), we'll call `revalidateTag("journalPost")` on
//    publish and drop the TTL dependence entirely.
//
// Published filter: `defined(publishedAt) && publishedAt < now()` — keeps
// drafts + future-dated posts out. When draft-preview mode lands we'll
// split this into two queries (published + preview).

import { sanityClient, isSanityConfigured } from "./client";
import type { JournalPost, JournalPostCard } from "./types";

const POST_CARD_FIELDS = `
  _id,
  title,
  "slug": slug.current,
  publishedAt,
  excerpt,
  tags,
  featured,
  coverImage {
    asset->{ url, metadata { lqip, dimensions } },
    "alt": alt,
    hotspot,
    crop
  }
`;

const POST_FULL_FIELDS = `
  ${POST_CARD_FIELDS},
  body[] {
    ...,
    _type == "image" => {
      asset->{ url, metadata { lqip, dimensions } },
      "alt": alt,
      hotspot,
      crop
    }
  }
`;

// Guard every fetch — fresh clones without env should render the
// "coming soon" placeholder, not crash the route.
function guard<T>(fallback: T): Promise<T> {
  return Promise.resolve(fallback);
}

export async function getAllPosts(): Promise<JournalPostCard[]> {
  if (!isSanityConfigured()) return guard<JournalPostCard[]>([]);
  return sanityClient.fetch<JournalPostCard[]>(
    `*[_type == "journalPost" && defined(publishedAt) && publishedAt < now()]
      | order(publishedAt desc) { ${POST_CARD_FIELDS} }`,
    {},
    { next: { revalidate: 60, tags: ["journalPost"] } },
  );
}

export async function getPostBySlug(slug: string): Promise<JournalPost | null> {
  if (!isSanityConfigured()) return guard<JournalPost | null>(null);
  return sanityClient.fetch<JournalPost | null>(
    `*[_type == "journalPost" && slug.current == $slug][0] { ${POST_FULL_FIELDS} }`,
    { slug },
    { next: { revalidate: 60, tags: [`journalPost:${slug}`, "journalPost"] } },
  );
}

// Drives `generateStaticParams` for /journal/[slug]. On a fresh clone we
// return [] so the build doesn't try to prerender anything — the route still
// exists and will render on demand once Julian publishes.
export async function getPostSlugs(): Promise<string[]> {
  if (!isSanityConfigured()) return [];
  try {
    return await sanityClient.fetch<string[]>(
      `*[_type == "journalPost" && defined(publishedAt) && publishedAt < now()].slug.current`,
      {},
      { next: { revalidate: 60, tags: ["journalPost"] } },
    );
  } catch {
    // Network hiccup at build time shouldn't break the whole build — the
    // pages will render on demand in that case.
    return [];
  }
}

// Used by /journal/[slug] to show "more stories" after the post body.
// Simple "3 most recent other posts" — richer relatedness deferred.
export async function getRelatedPosts(
  currentSlug: string,
): Promise<JournalPostCard[]> {
  if (!isSanityConfigured()) return [];
  return sanityClient.fetch<JournalPostCard[]>(
    `*[_type == "journalPost"
        && defined(publishedAt)
        && publishedAt < now()
        && slug.current != $currentSlug]
      | order(publishedAt desc)[0...3] { ${POST_CARD_FIELDS} }`,
    { currentSlug },
    { next: { revalidate: 60, tags: ["journalPost"] } },
  );
}
