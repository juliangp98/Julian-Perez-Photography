// Journal post detail.
//
// Server component with `generateStaticParams` so published posts prerender
// at build time (wrapped in try/catch — a missing Sanity project shouldn't
// break the build). `dynamicParams: true` lets new posts render on demand
// between deploys via the 60s revalidation window.
//
// JSON-LD `BlogPosting` is emitted inline so search engines can index the
// article metadata (author, published date, cover image). This complements
// the LocalBusiness JSON-LD in the root layout — the two don't conflict.
//
// OG images go through `urlFor().width(1200).height(630)` so social shares
// get a properly-sized crop rather than the asset's intrinsic dimensions.

import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import Script from "next/script";
import type { Metadata } from "next";
import { PortableText } from "@/components/PortableText";
import { isSanityConfigured } from "@/sanity/client";
import { urlFor } from "@/sanity/image";
import {
  getPostBySlug,
  getPostSlugs,
  getRelatedPosts,
} from "@/sanity/queries";

const SITE_URL = "https://julianperezphotography.com";

type Params = { slug: string };

export async function generateStaticParams(): Promise<Params[]> {
  try {
    const slugs = await getPostSlugs();
    return slugs.map((slug) => ({ slug }));
  } catch {
    // Fail open: missing env or Sanity outage at build time shouldn't take
    // down the build. Pages render on demand instead.
    return [];
  }
}

// Let Next render un-prerendered slugs on-demand, matching how the CMS
// works (Julian publishes a new post → it appears without a redeploy).
export const dynamicParams = true;

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { slug } = await params;
  if (!isSanityConfigured()) return { title: "Journal" };
  const post = await getPostBySlug(slug);
  if (!post) return { title: "Journal" };
  const ogImage = post.coverImage
    ? urlFor(post.coverImage).width(1200).height(630).fit("crop").url()
    : undefined;
  const url = `${SITE_URL}/journal/${post.slug}`;
  return {
    title: post.title,
    description: post.excerpt,
    alternates: { canonical: url },
    openGraph: {
      title: post.title,
      description: post.excerpt,
      type: "article",
      url,
      publishedTime: post.publishedAt,
      images: ogImage
        ? [{ url: ogImage, width: 1200, height: 630, alt: post.title }]
        : undefined,
    },
    twitter: ogImage
      ? {
          card: "summary_large_image",
          title: post.title,
          description: post.excerpt,
          images: [ogImage],
        }
      : undefined,
  };
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export default async function JournalPostPage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { slug } = await params;
  // Preserve the coming-soon UX: if env is missing we don't 500, we 404 —
  // the /journal index already explains what's happening.
  if (!isSanityConfigured()) notFound();

  const post = await getPostBySlug(slug);
  if (!post) notFound();

  const cover = post.coverImage;
  const coverDims = cover.asset?.metadata?.dimensions;
  const coverLqip = cover.asset?.metadata?.lqip;
  const url = `${SITE_URL}/journal/${post.slug}`;
  const related = await getRelatedPosts(post.slug);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: post.title,
    description: post.excerpt,
    datePublished: post.publishedAt,
    dateModified: post.publishedAt,
    author: { "@type": "Person", name: "Julian Perez" },
    publisher: {
      "@type": "Organization",
      name: "Julian Perez Photography",
      logo: {
        "@type": "ImageObject",
        url: `${SITE_URL}/og.jpg`,
      },
    },
    image: cover.asset?.url
      ? [urlFor(cover).width(1600).fit("max").url()]
      : undefined,
    url,
    mainEntityOfPage: { "@type": "WebPage", "@id": url },
    keywords: post.tags?.join(", "),
  };

  return (
    <article className="max-w-3xl mx-auto px-6 lg:px-10 py-16">
      <Script
        id={`ld-blogposting-${post.slug}`}
        type="application/ld+json"
        strategy="afterInteractive"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <nav className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
        <Link href="/journal" className="hover:text-[var(--foreground)]">
          ← Journal
        </Link>
      </nav>

      <header className="mt-6">
        <div className="text-xs uppercase tracking-[0.18em] text-[var(--accent)]">
          {formatDate(post.publishedAt)}
        </div>
        <h1 className="mt-3 font-serif text-4xl md:text-5xl leading-[1.1]">
          {post.title}
        </h1>
        <p className="mt-4 text-lg text-[var(--muted)] leading-relaxed">
          {post.excerpt}
        </p>
      </header>

      {cover.asset?.url && (
        <figure className="mt-10 -mx-6 lg:mx-0">
          <Image
            src={urlFor(cover).width(1600).fit("max").auto("format").url()}
            alt={cover.alt ?? post.title}
            width={coverDims?.width ?? 1600}
            height={coverDims?.height ?? 1000}
            sizes="(min-width: 1024px) 768px, 100vw"
            priority
            placeholder={coverLqip ? "blur" : "empty"}
            blurDataURL={coverLqip}
            className="w-full h-auto lg:rounded-lg"
          />
          {cover.alt && (
            <figcaption className="mt-3 text-xs text-[var(--muted)] text-center px-6">
              {cover.alt}
            </figcaption>
          )}
        </figure>
      )}

      <div className="mt-10 prose-journal">
        <PortableText value={post.body} />
      </div>

      {post.tags && post.tags.length > 0 && (
        <div className="mt-12 pt-6 border-t border-[var(--border)]">
          <div className="text-xs uppercase tracking-[0.18em] text-[var(--muted)] mb-3">
            Tagged
          </div>
          <div className="flex flex-wrap gap-2">
            {post.tags.map((tag) => (
              <span
                key={tag}
                className="text-xs tracking-wide text-[var(--muted)] border border-[var(--border)] rounded-full px-3 py-1"
              >
                {tag}
              </span>
            ))}
          </div>
        </div>
      )}

      {related.length > 0 && (
        <section className="mt-16 pt-10 border-t border-[var(--border)]">
          <div className="flex items-end justify-between gap-4 flex-wrap mb-6">
            <h2 className="font-serif text-2xl">More stories</h2>
            <Link
              href="/journal"
              className="text-xs uppercase tracking-[0.18em] text-[var(--muted)] hover:text-[var(--foreground)]"
            >
              All posts →
            </Link>
          </div>
          <div className="grid gap-6 sm:grid-cols-3">
            {related.map((r) => {
              const rCover = r.coverImage;
              const rLqip = rCover.asset?.metadata?.lqip;
              const rDims = rCover.asset?.metadata?.dimensions;
              return (
                <Link
                  key={r._id}
                  href={`/journal/${r.slug}`}
                  className="group block"
                >
                  <div className="aspect-[4/5] overflow-hidden rounded-lg border border-[var(--border)] group-hover:border-[var(--foreground)] transition bg-[var(--border)]/40">
                    {rCover.asset?.url && (
                      <Image
                        src={urlFor(rCover)
                          .width(600)
                          .height(750)
                          .fit("crop")
                          .auto("format")
                          .url()}
                        alt={rCover.alt ?? r.title}
                        width={rDims?.width ?? 600}
                        height={rDims?.height ?? 750}
                        sizes="(min-width: 640px) 33vw, 100vw"
                        placeholder={rLqip ? "blur" : "empty"}
                        blurDataURL={rLqip}
                        className="w-full h-full object-cover group-hover:scale-[1.02] transition duration-500"
                      />
                    )}
                  </div>
                  <div className="mt-3 text-[10px] uppercase tracking-[0.18em] text-[var(--accent)]">
                    {formatDate(r.publishedAt)}
                  </div>
                  <h3 className="mt-1 font-serif text-lg leading-tight group-hover:text-[var(--accent)] transition">
                    {r.title}
                  </h3>
                </Link>
              );
            })}
          </div>
        </section>
      )}
    </article>
  );
}
