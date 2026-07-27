// A localized darkening scrim laid over a `fill` image so overlaid text stays
// legible without tinting the whole photo. One place owns the gradient values
// so every hero/card/tile reads consistently — tune here, not per call site.
//
//   edge="bottom" (default): a short scrim concentrated at the bottom, leaving
//     the upper half of the image clear. For cards + video tiles whose caption
//     sits at the bottom.
//   edge="hero": responsive — a gentle bottom scrim on mobile (where the hero
//     copy spans the full width) and a left→right scrim on desktop (where the
//     copy is left-aligned), so most of the photo shines on the right.
//
// Pair with `overlayTextClass` on the text itself: a subtle shadow that buys
// legibility so the scrim can stay light.

const SCRIMS = {
  // Subtle: darkens only the immediate text zone and returns to the raw image
  // quickly, so the photo is untouched outside the caption.
  bottom:
    "absolute inset-0 bg-gradient-to-t from-black/45 via-transparent via-32% to-transparent",
  hero:
    "absolute inset-0 bg-gradient-to-t from-black/45 via-transparent via-38% to-transparent md:bg-gradient-to-r md:from-black/50 md:via-transparent md:via-30% md:to-transparent",
} as const;

// Text shadow for text sitting over a photo — this, not a heavy scrim, carries
// most of the legibility, so the darkening can stay subtle.
export const overlayTextClass =
  "[text-shadow:0_1px_14px_rgba(0,0,0,0.55)]";

export default function ImageScrim({
  edge = "bottom",
}: {
  edge?: keyof typeof SCRIMS;
}) {
  return <div aria-hidden className={SCRIMS[edge]} />;
}
