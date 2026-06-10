// Featured journal post — a single editorially-flagged post surfaced on
// the home page between "Recent work" (portfolio teaser) and "What clients
// say" (Google Reviews). Editors toggle the `featured` boolean on a post
// in Studio to swap which post shows here.
//
// Visual distinction vs. the /journal index cards:
//   - Two-column layout on lg+ (image left, copy right) so it reads like a
//     featured spotlight, not "another journal link."
//   - Shared-border section styling matches the other home-page sections
//     (services teaser, portfolio teaser) so it feels native — not a
//     bolt-on.
//   - The eyebrow label + heading mimic the other section headers
//     ("Services / What I photograph", "Portfolio / Recent work") for
//     consistency.
//
// Empty state is handled by the CALLER (src/app/page.tsx) — when
// getFeaturedPost() returns null, the page simply doesn't render this
// component. That keeps the empty-home layout clean (no gap, no
// "coming soon" placeholder) and keeps the component itself total about
// rendering a present post.

import Link from "next/link";
import SafeImage from "@/components/SafeImage";
import { urlFor } from "@/sanity/image";
import type { JournalPostCard } from "@/sanity/types";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export default function FeaturedJournalPost({
  post,
}: {
  post: JournalPostCard;
}) {
  const cover = post.coverImage;
  const dims = cover.asset?.metadata?.dimensions;
  const lqip = cover.asset?.metadata?.lqip;
  // 4:5 portrait crop to match the /journal index cards — visually ties
  // this section to the full journal page so clicking through feels
  // continuous, not like landing on a different-feeling site.
  const coverUrl = cover.asset?.url
    ? urlFor(cover).width(1200).height(1500).fit("crop").auto("format").url()
    : undefined;
  return (
    <section className="border-t border-[var(--border)]">
      <div className="max-w-7xl mx-auto px-6 lg:px-10 py-20">
        <div className="flex items-end justify-between mb-10 gap-6 flex-wrap">
          <div>
            <div className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
              From the journal
            </div>
            <h2 className="mt-2 font-serif text-4xl">Latest story</h2>
          </div>
          <Link
            href="/journal"
            className="text-sm underline underline-offset-4"
          >
            Read more stories &rarr;
          </Link>
        </div>

        <Link
          href={`/journal/${post.slug}`}
          className="group grid gap-8 lg:grid-cols-2 lg:gap-12 items-center"
        >
          <div className="aspect-[4/5] overflow-hidden rounded-lg border border-[var(--border)] group-hover:border-[var(--foreground)] transition bg-[var(--border)]/40">
            {coverUrl && (
              <SafeImage
                src={coverUrl}
                alt={cover.alt ?? post.title}
                width={dims?.width ?? 1200}
                height={dims?.height ?? 1500}
                // Home page lays this out at ~50vw on desktop, full-width
                // on mobile. Matching the actual layout lets Next serve
                // the right srcset variant.
                sizes="(min-width: 1024px) 50vw, 100vw"
                placeholder={lqip ? "blur" : "empty"}
                blurDataURL={lqip}
                className="w-full h-full object-cover group-hover:scale-[1.02] transition duration-500"
                // Below the fold on most viewports (after hero + services
                // + portfolio teasers) — keep it out of the LCP fight.
                loading="lazy"
              />
            )}
          </div>
          <div>
            <div className="text-xs uppercase tracking-[0.18em] text-[var(--accent)]">
              {formatDate(post.publishedAt)}
            </div>
            <h3 className="mt-3 font-serif text-3xl lg:text-4xl leading-tight group-hover:text-[var(--accent)] transition">
              {post.title}
            </h3>
            <p className="mt-4 text-[var(--muted)] text-lg leading-relaxed line-clamp-4">
              {post.excerpt}
            </p>
            {post.tags && post.tags.length > 0 && (
              <div className="mt-5 flex flex-wrap gap-2">
                {post.tags.slice(0, 3).map((tag) => (
                  <span
                    key={tag}
                    className="text-[10px] uppercase tracking-[0.14em] text-[var(--muted)] border border-[var(--border)] rounded-full px-2 py-0.5"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}
            <div className="mt-8 text-xs uppercase tracking-widest text-[var(--accent)] group-hover:text-[var(--foreground)]">
              Read the story &rarr;
            </div>
          </div>
        </Link>
      </div>
    </section>
  );
}
