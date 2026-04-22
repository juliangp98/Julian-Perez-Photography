// Hand-written shapes for the journal content model. sanity-codegen is
// intentionally skipped — the hand-rolled types track the schema closely
// enough, and the codegen step isn't worth the extra build dependency
// until the content model grows substantially.
//
// All image-bearing shapes project the asset's `metadata.lqip` and
// `metadata.dimensions` so pages can pass them straight to <Image>
// (placeholder="blur", blurDataURL=lqip) without a second round-trip.

import type { PortableTextBlock } from "@portabletext/types";

export type SanityImageMetadata = {
  lqip?: string;
  dimensions?: {
    width: number;
    height: number;
    aspectRatio: number;
  };
};

export type SanityImageAsset = {
  asset?: {
    url: string;
    metadata?: SanityImageMetadata;
  };
  alt?: string;
  hotspot?: { x: number; y: number; height: number; width: number };
  crop?: { top: number; bottom: number; left: number; right: number };
};

// Card shape: what the journal index lists. Body is omitted — the excerpt
// is enough to render a card, and skipping `body` keeps the index response
// tiny even if Julian publishes 100+ posts.
export type JournalPostCard = {
  _id: string;
  title: string;
  slug: string;
  publishedAt: string;
  excerpt: string;
  tags?: string[];
  featured?: boolean;
  coverImage: SanityImageAsset;
};

// Full post — card fields + the portable-text body (which can itself contain
// images, rendered via the custom serializer in src/components/PortableText.tsx).
export type JournalPost = JournalPostCard & {
  // Sanity's inline images get transformed to `{ _type: "image", asset: {...}, alt, ... }`
  // alongside regular block content; PortableText's types call this union
  // PortableTextBlock when typed loosely.
  body: (PortableTextBlock | SanityImageAsset)[];
};
