import Link from "next/link";
import type { Metadata } from "next";
import {
  visiblePortfolios as portfolios,
  visibleServices as services,
  siteSettings,
} from "@/lib/content";
import GoogleReviews from "@/components/GoogleReviews";

export const metadata: Metadata = {
  title: `${siteSettings.siteName} · DMV Wedding, Portrait & Event Photographer`,
  description:
    "DMV-based photographer covering weddings, engagements, graduations, portraits, family events, maternity, headshots, and corporate events across Northern Virginia, Washington DC, and Maryland.",
  alternates: { canonical: "https://julianperezphotography.com" },
};

export default function HomePage() {
  return (
    <>
      {/* Hero */}
      <section className="border-b border-[var(--border)]">
        <div className="max-w-7xl mx-auto px-6 lg:px-10 py-24 lg:py-32">
          <div className="max-w-3xl">
            <div className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
              {siteSettings.coverageArea} · {siteSettings.bookingStatus}
            </div>
            <h1 className="mt-6 font-serif text-5xl lg:text-7xl leading-[1.05]">
              {siteSettings.tagline}
            </h1>
            <p className="mt-6 text-lg text-[var(--muted)] max-w-xl">
              Wedding, engagement, graduation, portrait, and event photography
              across the DMV — built around who you are, not a shot list.
            </p>
            <div className="mt-10 flex flex-wrap gap-4">
              <Link
                href="/portfolio"
                className="px-6 py-3 border border-[var(--foreground)] rounded-full hover:bg-[var(--foreground)] hover:text-[var(--background)] transition"
              >
                View portfolio
              </Link>
              <Link
                href="/inquire"
                className="px-6 py-3 bg-[var(--foreground)] text-[var(--background)] rounded-full hover:opacity-90 transition"
              >
                Inquire
              </Link>
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

      {/* Google Reviews */}
      <section className="border-t border-[var(--border)]">
        <div className="max-w-7xl mx-auto px-6 lg:px-10 py-20">
          <GoogleReviews heading="What clients say" limit={3} />
        </div>
      </section>

      {/* CTA */}
      <section className="border-t border-[var(--border)]">
        <div className="max-w-7xl mx-auto px-6 lg:px-10 py-20 text-center">
          <h2 className="font-serif text-4xl max-w-2xl mx-auto">
            Let&rsquo;s make something you&rsquo;ll actually want to hang on the
            wall.
          </h2>
          <div className="mt-8 flex justify-center gap-4">
            <Link
              href="/inquire"
              className="px-6 py-3 bg-[var(--foreground)] text-[var(--background)] rounded-full hover:opacity-90 transition"
            >
              Start an inquiry
            </Link>
            <Link
              href="/book"
              className="px-6 py-3 border border-[var(--foreground)] rounded-full hover:bg-[var(--foreground)] hover:text-[var(--background)] transition"
            >
              Book a session
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
