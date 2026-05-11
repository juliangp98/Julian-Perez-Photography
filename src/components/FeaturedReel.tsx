// Single-video hero block. Surfaces the `featured: true` entry from a
// portfolio's videos array as a 16:9 tile with a click-to-open
// lightbox. Used at the top of `/services/wedding-films` to give
// browsing couples something to watch before the tier grid loads.
//
// Shape parallels VideoGallery (same lightbox plugins, same custom
// YouTube renderer, same thumbnail + play affordance) but renders one
// hero-sized tile instead of a grid. Two call sites diverge on layout
// only — the playback path is identical, so consistency between the
// hero and the full archive matters more than DRY.

"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import Lightbox from "yet-another-react-lightbox";
import Counter from "yet-another-react-lightbox/plugins/counter";
import Fullscreen from "yet-another-react-lightbox/plugins/fullscreen";
import Video from "yet-another-react-lightbox/plugins/video";
import "yet-another-react-lightbox/styles.css";
import "yet-another-react-lightbox/plugins/counter.css";
import type { VideoEntry } from "@/lib/types";

type Props = {
  video: VideoEntry;
  // The portfolio slug this video lives under, for the "View all"
  // cross-link below the hero. Optional — omitting it hides the link.
  portfolioSlug?: string;
  portfolioTitle?: string;
};

// Tolerant parser for YouTube IDs. Accepts a bare 11-char ID or any of
// the common pasted URL forms (watch, share, embed, shorts) and
// returns just the ID. Falls through unchanged when no pattern matches
// so a malformed value still surfaces visibly. Mirrors the helper in
// VideoGallery — kept inline here to keep this component standalone.
function normalizeYouTubeId(input: string): string {
  if (/^[A-Za-z0-9_-]{11}$/.test(input)) return input;
  const shortMatch = input.match(/youtu\.be\/([A-Za-z0-9_-]{11})/);
  if (shortMatch) return shortMatch[1];
  const watchMatch = input.match(/[?&]v=([A-Za-z0-9_-]{11})/);
  if (watchMatch) return watchMatch[1];
  const pathMatch = input.match(
    /youtube\.com\/(?:embed|shorts|v)\/([A-Za-z0-9_-]{11})/,
  );
  if (pathMatch) return pathMatch[1];
  return input;
}

function youtubeThumbnail(videoId: string): string {
  return `https://i.ytimg.com/vi/${normalizeYouTubeId(videoId)}/maxresdefault.jpg`;
}

export default function FeaturedReel({
  video,
  portfolioSlug,
  portfolioTitle,
}: Props) {
  const [open, setOpen] = useState(false);

  const thumbSrc =
    video.thumbnail ??
    (video.source.kind === "youtube"
      ? youtubeThumbnail(video.source.videoId)
      : null);

  const slide =
    video.source.kind === "youtube"
      ? {
          type: "youtube" as const,
          videoId: normalizeYouTubeId(video.source.videoId),
          title: video.title,
        }
      : {
          type: "video" as const,
          sources: [{ src: video.source.url, type: "video/mp4" }],
          title: video.title,
        };

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="group relative block w-full overflow-hidden rounded-lg bg-[var(--border)]/40 focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2"
        style={{ aspectRatio: "16 / 9" }}
        aria-label={`Play featured film: ${video.title}`}
      >
        {thumbSrc ? (
          <Image
            src={thumbSrc}
            alt={video.title}
            fill
            sizes="(min-width: 1024px) 1024px, 100vw"
            placeholder={video.thumbnailBlurDataURL ? "blur" : "empty"}
            blurDataURL={video.thumbnailBlurDataURL}
            priority
            className="object-cover transition duration-500 group-hover:scale-[1.02]"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-[var(--muted)] text-xs uppercase tracking-[0.18em]">
            Thumbnail unavailable
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/0 to-black/0" />
        <div className="absolute inset-0 flex items-center justify-center">
          <span
            aria-hidden
            className="flex h-12 w-12 sm:h-14 sm:w-14 lg:h-16 lg:w-16 items-center justify-center rounded-full bg-white/15 backdrop-blur-sm text-white text-xl sm:text-2xl transition group-hover:bg-white/25"
          >
            ▶
          </span>
        </div>
        {/* Overlay metadata sized to scale down with narrower tile
            widths — the featured reel can land in a 2/5-column slot at
            md+, so absolute sizes like `text-3xl` overflow before the
            mobile-stack breakpoint kicks in. Padding + font ramps
            mirror the tile's own width breakpoints. Title is clamped
            to two lines so longer film names don't push the date row
            below the play affordance. */}
        <div className="absolute bottom-0 left-0 right-0 p-3 sm:p-4 lg:p-5 text-left text-white">
          <div className="text-[9px] sm:text-[10px] uppercase tracking-[0.2em] text-white/85">
            Featured film
          </div>
          <div className="mt-1 font-serif text-base sm:text-lg lg:text-xl leading-tight line-clamp-2">
            {video.title}
          </div>
          {(video.venue || video.date) && (
            <div className="mt-1 text-[10px] sm:text-xs uppercase tracking-[0.16em] text-white/80 line-clamp-1">
              {[video.venue, video.date ? new Date(video.date).getFullYear() : null]
                .filter(Boolean)
                .join(" · ")}
            </div>
          )}
        </div>
      </button>

      {portfolioSlug && (
        <div className="mt-3 flex justify-end">
          <Link
            href={`/portfolio/${portfolioSlug}`}
            className="text-xs uppercase tracking-[0.2em] text-[var(--accent)] hover:text-[var(--foreground)]"
          >
            View all {portfolioTitle?.toLowerCase() ?? "films"} →
          </Link>
        </div>
      )}

      <Lightbox
        open={open}
        close={() => setOpen(false)}
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        slides={[slide as any]}
        plugins={[Video, Counter, Fullscreen]}
        animation={{ fade: 250 }}
        carousel={{ finite: true }}
        controller={{ closeOnBackdropClick: true }}
        styles={{
          container: { backgroundColor: "rgba(14, 14, 14, 0.96)" },
        }}
        render={{
          slide: ({ slide: s }) => {
            const ytSlide = s as { type?: string; videoId?: string };
            if (ytSlide.type !== "youtube" || !ytSlide.videoId) return undefined;
            return (
              <div
                style={{
                  width: "min(100%, 1200px)",
                  aspectRatio: "16 / 9",
                  margin: "0 auto",
                }}
              >
                <iframe
                  src={`https://www.youtube-nocookie.com/embed/${ytSlide.videoId}?autoplay=1&rel=0`}
                  title="Video player"
                  allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  style={{ width: "100%", height: "100%", border: 0 }}
                />
              </div>
            );
          },
        }}
      />
    </div>
  );
}
