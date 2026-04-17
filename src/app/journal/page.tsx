// Journal index — a reverse-chronological list of published posts.
//
// Server component: all data fetching happens in `getAllPosts()` which
// already hits Sanity with `next: { revalidate: 60 }`. No client-side state
// is needed.
//
// Three render paths:
//   1. No Sanity env configured        → "Coming soon" placeholder.
//   2. Env configured, zero posts yet  → "First story is in the works".
//   3. Env configured, posts exist     → reverse-chronological card grid.
//
// OG image: when at least one post exists, use the latest post's cover so
// social shares show something meaningful instead of the site default.

import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import { getAllPosts } from "@/sanity/queries";
import { isSanityConfigured } from "@/sanity/client";
import { urlFor } from "@/sanity/image";

export async function generateMetadata(): Promise<Metadata> {
  const title = "Journal";
  const description =
    "Stories from behind the lens — weddings, portraits, and scenes from across the DMV.";
  if (!isSanityConfigured()) {
    return { title, description };
  }
  const posts = await getAllPosts();
  const latestCover = posts[0]?.coverImage;
  const ogImage = latestCover
    ? urlFor(latestCover).width(1200).height(630).fit("crop").url()
    : undefined;
  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: "website",
      images: ogImage ? [{ url: ogImage, width: 1200, height: 630 }] : undefined,
    },
    twitter: ogImage
      ? { card: "summary_large_image", images: [ogImage] }
      : undefined,
  };
}

function JournalShell({
  heading,
  children,
}: {
  heading: string;
  children: React.ReactNode;
}) {
  return (
    <section className="max-w-7xl mx-auto px-6 lg:px-10 py-20">
      <div className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
        Journal
      </div>
      <h1 className="mt-2 font-serif text-5xl">{heading}</h1>
      {children}
    </section>
  );
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export default async function JournalIndex() {
  // Fresh-clone path: no env = render the coming-soon block. This keeps
  // CI green and the preview build meaningful before Julian wires the
  // Sanity project. Same pattern as `/journal/[slug]` below.
  if (!isSanityConfigured()) {
    return (
      <JournalShell heading="Coming soon">
        <p className="mt-4 text-[var(--muted)] max-w-2xl">
          Journal entries are on the way — personal notes, client stories, and
          scenes from recent sessions. Subscribe on Instagram for updates until
          the feed goes live here.
        </p>
      </JournalShell>
    );
  }

  const posts = await getAllPosts();
  if (posts.length === 0) {
    return (
      <JournalShell heading="First story is in the works">
        <p className="mt-4 text-[var(--muted)] max-w-2xl">
          The first journal entries are being drafted. Check back soon for
          essays, client features, and behind-the-lens notes from weddings and
          portrait sessions across the DMV.
        </p>
      </JournalShell>
    );
  }

  return (
    <JournalShell heading="Stories from behind the lens">
      <p className="mt-4 text-[var(--muted)] max-w-2xl">
        Essays, client features, and notes from weddings, portraits, and
        events across Northern Virginia, DC, and Maryland.
      </p>
      <div className="mt-16 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
        {posts.map((post) => {
          const cover = post.coverImage;
          const dims = cover.asset?.metadata?.dimensions;
          const lqip = cover.asset?.metadata?.lqip;
          return (
            <Link
              key={post._id}
              href={`/journal/${post.slug}`}
              className="group block"
            >
              <div className="aspect-[4/5] overflow-hidden rounded-lg border border-[var(--border)] group-hover:border-[var(--foreground)] transition bg-[var(--border)]/40">
                {cover.asset?.url && (
                  <Image
                    src={urlFor(cover).width(900).height(1125).fit("crop").auto("format").url()}
                    alt={cover.alt ?? post.title}
                    width={dims?.width ?? 900}
                    height={dims?.height ?? 1125}
                    sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
                    placeholder={lqip ? "blur" : "empty"}
                    blurDataURL={lqip}
                    className="w-full h-full object-cover group-hover:scale-[1.02] transition duration-500"
                  />
                )}
              </div>
              <div className="mt-4">
                <div className="text-xs uppercase tracking-[0.18em] text-[var(--accent)]">
                  {formatDate(post.publishedAt)}
                </div>
                <h2 className="mt-2 font-serif text-2xl leading-tight group-hover:text-[var(--accent)] transition">
                  {post.title}
                </h2>
                <p className="mt-2 text-sm text-[var(--muted)] line-clamp-3">
                  {post.excerpt}
                </p>
                {post.tags && post.tags.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
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
              </div>
            </Link>
          );
        })}
      </div>
    </JournalShell>
  );
}
