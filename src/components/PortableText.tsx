// Brand-styled Portable Text renderer. Sanity returns body content as
// Portable Text (an array of blocks — paragraphs, headings, images, etc.),
// and @portabletext/react's <PortableText> walks the tree invoking these
// serializers. Without custom serializers we'd get minimally-styled HTML.
//
// Three groups of overrides:
//  - `types.image`  → render inline images via next/image with LQIP blur
//  - `block.h2/h3/blockquote` → brand typography (serif headings, accent rule)
//  - `marks.link`  → external safety (noreferrer) + same-tab for internal
//
// Kept a plain component (no "use client") so it can be composed into the
// journal detail page which is a server component. Next handles image
// optimization server-side regardless.
//
// When round 14 ships dormant-schema content, this same component can serve
// About-page body content (which will use the same `body` portable-text
// shape) — no changes expected.

import Image from "next/image";
import Link from "next/link";
import {
  PortableText as BasePortableText,
  type PortableTextComponents,
  type PortableTextMarkComponentProps,
  type PortableTextTypeComponentProps,
} from "@portabletext/react";
import { urlFor } from "@/sanity/image";
import type { SanityImageAsset } from "@/sanity/types";

// Sanity stores inline images as a block of `_type: "image"` and our GROQ
// query projects them with `asset->{ url, metadata { lqip, dimensions } }`.
// Type narrows what the serializer receives.
type InlineImageValue = SanityImageAsset & { _type: "image" };

function InlineImage({ value }: PortableTextTypeComponentProps<InlineImageValue>) {
  const asset = value.asset;
  if (!asset?.url) return null;
  const dims = asset.metadata?.dimensions;
  // Fallback square if Sanity ever returns an image without metadata (rare
  // but possible for legacy assets). 1600×1600 is visually reasonable and
  // Next/Image will scale down to the rendered size.
  const width = dims?.width ?? 1600;
  const height = dims?.height ?? 1600;
  const src = urlFor(value).width(1600).fit("max").auto("format").url();
  return (
    <figure className="my-8">
      <Image
        src={src}
        alt={value.alt ?? ""}
        width={width}
        height={height}
        sizes="(min-width: 768px) 768px, 100vw"
        placeholder={asset.metadata?.lqip ? "blur" : "empty"}
        blurDataURL={asset.metadata?.lqip}
        className="w-full h-auto rounded-lg"
      />
      {value.alt && (
        <figcaption className="mt-3 text-xs text-[var(--muted)] text-center">
          {value.alt}
        </figcaption>
      )}
    </figure>
  );
}

function ExternalLink({
  value,
  children,
}: PortableTextMarkComponentProps<{ _type: "link"; href?: string }>) {
  const href = value?.href ?? "#";
  const isExternal = /^https?:\/\//i.test(href);
  if (isExternal) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noreferrer noopener"
        className="underline underline-offset-4 hover:text-[var(--accent)] transition"
      >
        {children}
      </a>
    );
  }
  // Internal links go through next/link for client-side nav.
  return (
    <Link
      href={href}
      className="underline underline-offset-4 hover:text-[var(--accent)] transition"
    >
      {children}
    </Link>
  );
}

const components: PortableTextComponents = {
  types: {
    image: InlineImage,
  },
  block: {
    // Body copy (h1 reserved for page title — never render h1 inside post body).
    h2: ({ children }) => (
      <h2 className="font-serif text-3xl md:text-4xl mt-10 mb-4">{children}</h2>
    ),
    h3: ({ children }) => (
      <h3 className="font-serif text-2xl mt-8 mb-3">{children}</h3>
    ),
    blockquote: ({ children }) => (
      <blockquote className="my-6 pl-5 border-l-2 border-[var(--accent)] italic text-[var(--muted)]">
        {children}
      </blockquote>
    ),
    normal: ({ children }) => (
      <p className="my-4 leading-relaxed text-base md:text-lg">{children}</p>
    ),
  },
  marks: {
    link: ExternalLink,
    strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
    em: ({ children }) => <em className="italic">{children}</em>,
  },
  list: {
    bullet: ({ children }) => (
      <ul className="my-4 pl-6 list-disc space-y-2">{children}</ul>
    ),
    number: ({ children }) => (
      <ol className="my-4 pl-6 list-decimal space-y-2">{children}</ol>
    ),
  },
  listItem: {
    bullet: ({ children }) => <li className="leading-relaxed">{children}</li>,
    number: ({ children }) => <li className="leading-relaxed">{children}</li>,
  },
};

// Using `any` for the value prop because the union of PortableTextBlock +
// SanityImageAsset is painful to express statically and the base component
// handles runtime dispatch via the `_type` discriminator anyway.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function PortableText({ value }: { value: any }) {
  return <BasePortableText value={value} components={components} />;
}
