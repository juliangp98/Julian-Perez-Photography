// Thin wrapper around @sanity/image-url so pages call `urlFor(img).width(1200).url()`
// without each one re-instantiating the builder. The builder is cheap but
// sharing it keeps call sites tiny.

import { createImageUrlBuilder } from "@sanity/image-url";
import type { SanityImageSource } from "@sanity/image-url";
import { sanityClient } from "./client";

// Named export `createImageUrlBuilder` — the default export is deprecated
// and logs a warning at build time (it still works, just noisy).
const builder = createImageUrlBuilder(sanityClient);

export function urlFor(source: SanityImageSource) {
  return builder.image(source);
}
