// Video grid + lightbox for the wedding-films portfolio (and any future
// video portfolio that surfaces under /portfolio/<slug>). Mirrors the
// shape of `PortfolioGallery` but renders video tiles and uses
// `yet-another-react-lightbox`'s Video plugin for HTML5 video and a
// custom slide renderer for YouTube embeds.
//
// Design notes:
//   - The featured entry (most recent if multiple are flagged) renders
//     as a hero tile that spans two columns at md+ breakpoints.
//   - Sort precedence: featured first, then manual `order` ascending,
//     then `date` descending (newest first natural fill).
//   - YouTube thumbnails fall back to i.ytimg.com when no manual
//     `thumbnail` path is set; blob videos must supply a thumbnail
//     since blob URLs don't expose a frame extractor.
//   - The lightbox carousel is finite (couples scroll a small archive,
//     not infinite reels) and click-on-backdrop closes.

"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import Lightbox from "yet-another-react-lightbox";
import Counter from "yet-another-react-lightbox/plugins/counter";
import Fullscreen from "yet-another-react-lightbox/plugins/fullscreen";
import Video from "yet-another-react-lightbox/plugins/video";
import "yet-another-react-lightbox/styles.css";
import "yet-another-react-lightbox/plugins/counter.css";
import type { VideoEntry } from "@/lib/types";

type Props = { videos: VideoEntry[] };

// Tolerant parser for YouTube IDs. Studio's `youtubeId` field expects a
// bare 11-char ID, but a quick paste from the address bar often lands a
// full URL or a youtu.be short link in there instead. Accepts the most
// common forms and returns just the ID; falls through unchanged when no
// pattern matches so a malformed value still surfaces visibly in the
// embed rather than getting silently coerced.
function normalizeYouTubeId(input: string): string {
  // Already a bare ID — YouTube IDs are 11 chars of [A-Za-z0-9_-].
  if (/^[A-Za-z0-9_-]{11}$/.test(input)) return input;
  // youtu.be/<id>
  const shortMatch = input.match(/youtu\.be\/([A-Za-z0-9_-]{11})/);
  if (shortMatch) return shortMatch[1];
  // youtube.com/watch?...v=<id>
  const watchMatch = input.match(/[?&]v=([A-Za-z0-9_-]{11})/);
  if (watchMatch) return watchMatch[1];
  // youtube.com/embed/<id> or youtube.com/shorts/<id>
  const pathMatch = input.match(
    /youtube\.com\/(?:embed|shorts|v)\/([A-Za-z0-9_-]{11})/,
  );
  if (pathMatch) return pathMatch[1];
  return input;
}

// YouTube's auto-generated thumbnail. `maxresdefault.jpg` is the highest
// resolution that's reliably available; some videos only have hqdefault
// (480x360) so consumers should be tolerant of either size at render time.
function youtubeThumbnail(videoId: string): string {
  return `https://i.ytimg.com/vi/${normalizeYouTubeId(videoId)}/maxresdefault.jpg`;
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

// Stable sort: featured first (most recent date wins among featured),
// then manual `order` (lower first), then date descending. Hidden
// entries are filtered out.
function sortedForDisplay(videos: VideoEntry[]): VideoEntry[] {
  return [...videos]
    .filter((v) => !v.hidden)
    .sort((a, b) => {
      if (!!a.featured !== !!b.featured) return a.featured ? -1 : 1;
      if (a.order != null && b.order != null) return a.order - b.order;
      if (a.order != null) return -1;
      if (b.order != null) return 1;
      if (a.date && b.date) return b.date.localeCompare(a.date);
      if (a.date) return -1;
      if (b.date) return 1;
      return 0;
    });
}

export default function VideoGallery({ videos }: Props) {
  const ordered = useMemo(() => sortedForDisplay(videos), [videos]);
  const [index, setIndex] = useState(-1);

  if (ordered.length === 0) {
    return (
      <div className="mt-16 p-10 border border-dashed border-[var(--border)] rounded-lg text-center">
        <p className="text-[var(--muted)]">
          Wedding films coming soon — recent films will be added here as they
          finish post-production.
        </p>
      </div>
    );
  }

  // Slides for the lightbox. The Video plugin recognizes `type: "video"`
  // with a `sources` array; the custom render below handles the YouTube
  // case via its videoId.
  const slides = ordered.map((v) => {
    if (v.source.kind === "youtube") {
      return {
        type: "youtube" as const,
        videoId: normalizeYouTubeId(v.source.videoId),
        title: v.title,
      };
    }
    return {
      type: "video" as const,
      sources: [{ src: v.source.url, type: "video/mp4" }],
      title: v.title,
    };
  });

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-6">
        {ordered.map((v, i) => {
          const thumbSrc =
            v.thumbnail ??
            (v.source.kind === "youtube"
              ? youtubeThumbnail(v.source.videoId)
              : null);
          const featuredHero = v.featured && i === 0;
          return (
            <button
              key={v.id}
              type="button"
              onClick={() => setIndex(i)}
              className={[
                "group relative block w-full overflow-hidden rounded-lg",
                "bg-[var(--border)]/40",
                "focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2",
                featuredHero ? "md:col-span-2 md:row-span-2" : "",
              ]
                .filter(Boolean)
                .join(" ")}
              style={{ aspectRatio: "16 / 9" }}
            >
              {thumbSrc ? (
                <Image
                  src={thumbSrc}
                  alt={v.title}
                  fill
                  sizes={
                    featuredHero
                      ? "(min-width: 1024px) 66vw, (min-width: 768px) 100vw, 100vw"
                      : "(min-width: 1024px) 33vw, (min-width: 768px) 50vw, 100vw"
                  }
                  placeholder={v.thumbnailBlurDataURL ? "blur" : "empty"}
                  blurDataURL={v.thumbnailBlurDataURL}
                  // First tile is above the fold and is the LCP
                  // candidate on the portfolio page. Eager-load it so
                  // Next/Image doesn't lazy-load and delay the
                  // largest contentful paint.
                  priority={i === 0}
                  className="object-cover transition duration-500 group-hover:scale-[1.02]"
                />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center text-[var(--muted)] text-xs uppercase tracking-[0.18em]">
                  Thumbnail unavailable
                </div>
              )}
              {/* Subtle gradient + play affordance + metadata overlay */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-black/0 to-black/0" />
              <div className="absolute inset-0 flex items-center justify-center">
                <span
                  aria-hidden
                  className="flex h-14 w-14 items-center justify-center rounded-full bg-white/15 backdrop-blur-sm text-white text-2xl transition group-hover:bg-white/25"
                >
                  ▶
                </span>
              </div>
              {v.durationSeconds != null && (
                <span className="absolute top-3 right-3 rounded bg-black/65 px-2 py-1 text-[11px] font-medium text-white tabular-nums">
                  {formatDuration(v.durationSeconds)}
                </span>
              )}
              <div className="absolute bottom-0 left-0 right-0 p-4 text-left text-white">
                <div className="font-serif text-xl leading-tight">
                  {v.title}
                </div>
                {(v.venue || v.date) && (
                  <div className="mt-1 text-xs uppercase tracking-[0.16em] text-white/85">
                    {[v.venue, v.date ? new Date(v.date).getFullYear() : null]
                      .filter(Boolean)
                      .join(" · ")}
                  </div>
                )}
              </div>
            </button>
          );
        })}
      </div>

      <Lightbox
        open={index >= 0}
        close={() => setIndex(-1)}
        index={index}
        // The lightbox's `Slide` union is extensible via module
        // augmentation, but for one custom slide type ("youtube") it's
        // cleaner to cast at the boundary than to declare an
        // augmentation file. The runtime shape is what matters and
        // the custom `render.slide` below handles the YouTube case.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        slides={slides as any}
        plugins={[Video, Counter, Fullscreen]}
        animation={{ fade: 250 }}
        carousel={{ finite: true }}
        controller={{ closeOnBackdropClick: true }}
        styles={{
          container: { backgroundColor: "rgba(14, 14, 14, 0.96)" },
        }}
        render={{
          // Custom slide renderer for YouTube — the Video plugin handles
          // type: "video" natively, but YouTube embeds need an iframe.
          // Returning `undefined` falls through to the next renderer in
          // the chain (Video plugin or the lightbox's default).
          slide: ({ slide }) => {
            const s = slide as { type?: string; videoId?: string };
            if (s.type !== "youtube" || !s.videoId) return undefined;
            return (
              <div
                style={{
                  width: "min(100%, 1200px)",
                  aspectRatio: "16 / 9",
                  margin: "0 auto",
                }}
              >
                <iframe
                  src={`https://www.youtube-nocookie.com/embed/${s.videoId}?autoplay=1&rel=0`}
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
    </>
  );
}
