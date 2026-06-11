import Link from "next/link";
import type { Metadata } from "next";
import {
  getFeaturedPost,
  getSiteSettings,
  getVisiblePortfolios,
  getVisibleServices,
} from "@/lib/content";
import GoogleReviews from "@/components/marketing/GoogleReviews";
import FeaturedJournalPost from "@/components/marketing/FeaturedJournalPost";
import PressStrip from "@/components/marketing/PressStrip";

import Button from "@/components/ui/Button";
export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSiteSettings();
  return {
    title: `${settings.siteName} · DMV Wedding, Portrait & Event Photographer`,
    description:
      "DMV-based photographer covering weddings, engagements, graduations, portraits, family events, maternity, headshots, and corporate events across Northern Virginia, Washington DC, and Maryland.",
    alternates: { canonical: "https://julianperezphotography.com" },
  };
}

export default async function HomePage() {
  // Settings + services + portfolios + featured post fetched in parallel
  // — all four are React-cached so the layout / Footer / GoogleReviews
  // components re-use the same resolved promises without re-hitting
  // Sanity. Featured post can be null (no post flagged, or Sanity
  // unreachable) — the section is then silently skipped.
  const [settings, services, portfolios, featuredPost] = await Promise.all([
    getSiteSettings(),
    getVisibleServices(),
    getVisiblePortfolios(),
    getFeaturedPost(),
  ]);
  return (
    <>
      {/* Hero */}
      <section className="border-b border-[var(--border)]">
        <div className="max-w-7xl mx-auto px-6 lg:px-10 py-24 lg:py-32">
          <div className="max-w-3xl">
            <div className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
              {settings.coverageArea} · {settings.bookingStatus}
            </div>
            <h1 className="mt-6 font-serif text-5xl lg:text-7xl leading-[1.05]">
              {settings.tagline}
            </h1>
            <p className="mt-6 text-lg text-[var(--muted)] max-w-xl">
              Wedding, engagement, graduation, portrait, and event photography
              across the DMV — built around who you are, not a shot list.
            </p>
            <div className="mt-10 flex flex-wrap gap-4">
              <Button href="/portfolio" variant="secondary" size="lg">
                View portfolio
              </Button>
              <Button href="/inquire" size="lg">
                Inquire
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Services teaser */}
      <section className="max-w-7xl mx-auto px-6 lg:px-10 py-20">
        <div className="flex items-end justify-between mb-10 gap-6 flex-wrap">
          <div>
            <div className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
              Services
            </div>
            <h2 className="mt-2 font-serif text-4xl">What I photograph</h2>
          </div>
          <Link
            href="/services"
            className="text-sm underline underline-offset-4"
          >
            See all services &amp; pricing →
          </Link>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {services.slice(0, 6).map((s) => (
            <Link
              key={s.slug}
              href={`/services/${s.slug}`}
              className="group border border-[var(--border)] rounded-lg p-6 bg-white hover:border-[var(--foreground)] transition"
            >
              <h3 className="font-serif text-2xl">{s.title}</h3>
              <p className="mt-2 text-sm text-[var(--muted)]">{s.tagline}</p>
              <div className="mt-6 text-xs uppercase tracking-widest text-[var(--accent)] group-hover:text-[var(--foreground)]">
                Explore →
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* Portfolio teaser */}
      <section className="max-w-7xl mx-auto px-6 lg:px-10 py-20 border-t border-[var(--border)]">
        <div className="flex items-end justify-between mb-10 gap-6 flex-wrap">
          <div>
            <div className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
              Portfolio
            </div>
            <h2 className="mt-2 font-serif text-4xl">Recent work</h2>
          </div>
          <Link
            href="/portfolio"
            className="text-sm underline underline-offset-4"
          >
            View all portfolios →
          </Link>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {portfolios.slice(0, 6).map((p) => (
            <Link
              key={p.slug}
              href={`/portfolio/${p.slug}`}
              className="aspect-[4/5] bg-[var(--border)]/40 rounded-lg flex items-end p-5 relative overflow-hidden group"
            >
              <span className="font-serif text-xl text-[var(--foreground)]">
                {p.title}
              </span>
            </Link>
          ))}
        </div>
      </section>

      {/* Featured journal post — null → section hidden, no empty shell */}
      {featuredPost && <FeaturedJournalPost post={featuredPost} />}

      {/* Google Reviews */}
      <section className="border-t border-[var(--border)]">
        <div className="max-w-7xl mx-auto px-6 lg:px-10 py-20">
          <GoogleReviews heading="What clients say" limit={3} />
        </div>
      </section>

      {/* Press features — empty list → strip hidden */}
      <PressStrip />

      {/* CTA */}
      <section className="border-t border-[var(--border)]">
        <div className="max-w-7xl mx-auto px-6 lg:px-10 py-20 text-center">
          <h2 className="font-serif text-4xl max-w-2xl mx-auto">
            Let&rsquo;s make something you&rsquo;ll actually want to hang on the
            wall.
          </h2>
          <p className="mt-4 text-[var(--muted)] max-w-xl mx-auto">
            Have questions? Start with an inquiry. Already know which service
            you want? Jump straight into the planning questionnaire.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-4">
            <Button href="/inquire" variant="secondary" size="lg">
              Start an inquiry
            </Button>
            <Button href="/questionnaire" size="lg">
              Plan your session
            </Button>
            <Button href="/book" variant="secondary" size="lg">
              Book a session
            </Button>
          </div>
        </div>
      </section>
    </>
  );
}
