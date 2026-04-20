import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import {
  getPortfolio,
  getService,
  getVisiblePortfolios,
} from "@/lib/content";
import PortfolioGallery from "@/components/PortfolioGallery";

// Async after round 14c — slugs come from Sanity when configured and
// fall back to `portfoliosFallback` otherwise. Wrapped in try/catch so
// a network hiccup at build time doesn't break the build; pages still
// render on demand.
export async function generateStaticParams() {
  try {
    const portfolios = await getVisiblePortfolios();
    return portfolios.map((p) => ({ category: p.slug }));
  } catch {
    return [];
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ category: string }>;
}): Promise<Metadata> {
  const { category } = await params;
  const p = await getPortfolio(category);
  if (!p) return {};
  return { title: p.title, description: p.description };
}

export default async function PortfolioCategoryPage({
  params,
}: {
  params: Promise<{ category: string }>;
}) {
  const { category } = await params;
  // `getPortfolio` is async after round 14c — awaits the Sanity lookup.
  const p = await getPortfolio(category);
  if (!p) notFound();
  // `getService` is async after round 14b.2 — awaits the Sanity lookup
  // so the pricing-page cross-link only renders if the service is
  // currently visible in the catalog.
  const service = await getService(p.slug);

  return (
    <section className="max-w-7xl mx-auto px-6 lg:px-10 py-20">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <Link
          href="/portfolio"
          className="text-xs uppercase tracking-[0.2em] text-[var(--muted)] hover:text-[var(--foreground)]"
        >
          ← All portfolios
        </Link>
        {service && (
          <Link
            href={`/services/${p.slug}`}
            className="text-xs uppercase tracking-[0.2em] text-[var(--accent)] hover:text-[var(--foreground)]"
          >
            View <span className="hidden sm:inline">{p.title.toLowerCase()} </span>pricing →
          </Link>
        )}
      </div>
      <h1 className="mt-4 font-serif text-5xl">{p.title}</h1>
      <p className="mt-3 text-[var(--muted)] max-w-2xl">{p.description}</p>

      {p.images.length === 0 ? (
        <div className="mt-16 p-10 border border-dashed border-[var(--border)] rounded-lg text-center">
          <p className="text-[var(--muted)]">
            Gallery coming soon — images will be added once exported from the
            previous site.
          </p>
          <Link
            href={`/services/${p.slug}`}
            className="inline-block mt-6 px-5 py-2 border border-[var(--foreground)] rounded-full hover:bg-[var(--foreground)] hover:text-[var(--background)] transition text-sm"
          >
            View {p.title.toLowerCase()} pricing
          </Link>
        </div>
      ) : (
        <div className="mt-12">
          <PortfolioGallery images={p.images} />
        </div>
      )}
    </section>
  );
}
