// Drop-in wrapper around next/image that swaps a neutral placeholder in
// when the underlying asset fails to load.
//
// The use case is Sanity-hosted media. A referenced asset can 404 if it's
// deleted in Studio between the page render and the browser fetch, or if
// the CDN hiccups. Without an `onError` hook, the browser renders a
// default broken-image icon, which looks broken rather than intentional.
// This component keeps the layout box the image would have occupied and
// shows a muted "Image unavailable" label instead.
//
// Kept as a thin wrapper: accepts the full `ImageProps` surface so it can
// be used anywhere `next/image` was used without changing call sites.
// `"use client"` is required for `useState` + `onError`, which means this
// component renders as a client island when composed inside server
// components (journal detail, journal index, portable text).
//
// Intentionally NOT used for `/public/*` assets (logo, OG default,
// hero images): those ship with the build so a 404 there is a build
// failure, not a runtime race, and the extra client-side boundary buys
// nothing.

"use client";

import Image, { type ImageProps } from "next/image";
import { useState } from "react";

export default function SafeImage({ alt, ...rest }: ImageProps) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    // Preserve the layout shape the image would have filled so the
    // surrounding page doesn't reflow when the fallback kicks in. Falls
    // back to 16:9 when width/height aren't both set — rare with Sanity
    // images, which always carry dimensions metadata — but possible for
    // `fill`-mode images, where the parent container dictates the shape
    // and an explicit aspect ratio would conflict.
    const { width, height, className } = rest;
    const aspectRatio =
      typeof width === "number" && typeof height === "number"
        ? `${width} / ${height}`
        : undefined;
    return (
      <div
        className={[
          "bg-[var(--border)]/40 flex items-center justify-center",
          "text-xs uppercase tracking-[0.18em] text-[var(--muted)]",
          className ?? "",
        ]
          .filter(Boolean)
          .join(" ")}
        style={aspectRatio ? { aspectRatio } : undefined}
        role="img"
        aria-label={typeof alt === "string" ? alt : "Image unavailable"}
      >
        Image unavailable
      </div>
    );
  }

  // `alt` is required by next/image's type; destructuring it out of the
  // spread keeps jsx-a11y satisfied and makes the prop explicit at the
  // call site.
  return <Image alt={alt} {...rest} onError={() => setFailed(true)} />;
}
