import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import {
  getPortfolio,
  getService,
  getVisiblePortfolios,
} from "@/lib/content";
import { getPortfolioAltOverrides } from "@/lib/portfolio-alt";
import PortfolioGallery from "@/components/PortfolioGallery";
import VideoGallery from "@/components/VideoGallery";
import SubNav, { type SubNavItem } from "@/components/SubNav";

// Slugs come from Sanity when configured and fall back to
// `portfoliosFallback` otherwise. Wrapped in try/catch so a network
// hiccup at build time doesn't break the build; pages still render
// on demand.
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
  // `getPortfolio` is async — awaits the Sanity lookup.
  const p = await getPortfolio(category);
  if (!p) notFound();

  // Cross-link target. Defaults to the portfolio's own slug — which
  // works for every current portfolio, since each shares a slug with
  // its matching service (photo galleries and the wedding-films video
  // portfolio alike). The `serviceSlug` override exists for any future
  // portfolio whose slug intentionally diverges from its service.
  const linkedServiceSlug = p.serviceSlug ?? (p.slug as string);
  // `getService` is async — awaits the Sanity lookup so the pricing-
  // page cross-link only renders if the service is currently visible
  // in the catalog.
  const service = await getService(linkedServiceSlug);

  // Video portfolios are identified by an actual `videos` array (regardless of
  // length). Photo portfolios have no array: the local fallback omits the field
  // (undefined) and the Sanity projection returns null for it, so `Array.isArray`
  // is what distinguishes the two — a plain `!== undefined` check treats the
  // Sanity null as a video portfolio and shows every photo gallery the wedding-
  // films placeholder. An empty video archive still renders through VideoGallery
  // so its "coming soon" copy stays domain-appropriate.
  const isVideoPortfolio = Array.isArray(p.videos);

  // Persisted, admin-reviewed alt text wins over the manifest baseline. The
  // lookup is request-cached and no-ops to {} when Supabase isn't configured,
  // so galleries render fine on the manifest alt without it. Only photo
  // galleries with images need it.
  const altOverrides =
    !isVideoPortfolio && p.images.length > 0
      ? await getPortfolioAltOverrides()
      : {};
  const images = p.images.map((img) => ({
    ...img,
    alt: altOverrides[img.src] ?? img.alt,
  }));

  // Slug-scoped facet tabs: this category's portfolio + (when the matching
  // service is visible) its pricing, with a way back up to the full index.
  // Replaces the former top-right pricing cross-link.
  const facetTabs: SubNavItem[] = [
    { label: `${p.title} portfolio`, href: `/portfolio/${category}` },
  ];
  if (service) {
    facetTabs.push({
      label: `${p.title} pricing`,
      href: `/services/${linkedServiceSlug}`,
    });
  }

  return (
    <section className="max-w-7xl mx-auto px-6 lg:px-10 py-20">
      <SubNav
        items={facetTabs}
        back={{ label: "All portfolios", href: "/portfolio" }}
      />
      <h1 className="mt-6 font-serif text-5xl">{p.title}</h1>
      <p className="mt-3 text-[var(--muted)] max-w-2xl">{p.description}</p>

      {isVideoPortfolio ? (
        <div className="mt-12">
          <VideoGallery videos={p.videos ?? []} />
        </div>
      ) : p.images.length === 0 ? (
        <div className="mt-16 p-10 border border-dashed border-[var(--border)] rounded-lg text-center">
          <p className="text-[var(--muted)]">
            Gallery coming soon — images will be added once exported from the
            previous site.
          </p>
          {service && (
            <Link
              href={`/services/${linkedServiceSlug}`}
              className="inline-block mt-6 px-5 py-2 border border-[var(--foreground)] rounded-full hover:bg-[var(--foreground)] hover:text-[var(--background)] transition text-sm"
            >
              View {p.title.toLowerCase()} pricing
            </Link>
          )}
        </div>
      ) : (
        <div className="mt-12">
          <PortfolioGallery images={images} />
        </div>
      )}
    </section>
  );
}
