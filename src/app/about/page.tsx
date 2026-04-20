import Link from "next/link";
import type { Metadata } from "next";
import { getAboutPage, getSiteSettings } from "@/lib/content";

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSiteSettings();
  return {
    title: "About",
    description: `About ${settings.siteName} — Northeastern-trained engineer turned DMV wedding, portrait, and event photographer.`,
  };
}

export default async function AboutPage() {
  // Both getters are React-`cache`d; Promise.all shares the round-trip
  // with siteSettings (coverage area + booking status block below) so the
  // page waits on the slower of the two, not the sum.
  const [about, settings] = await Promise.all([
    getAboutPage(),
    getSiteSettings(),
  ]);
  return (
    <section className="max-w-3xl mx-auto px-6 lg:px-10 py-24">
      <div className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
        About
      </div>
      <h1 className="mt-2 font-serif text-5xl">{about.heading}</h1>
      <div className="mt-8 space-y-5 text-lg leading-relaxed text-[var(--foreground)]/90">
        {about.bio.map((paragraph, i) => (
          <p key={i}>{paragraph}</p>
        ))}
      </div>

      <div className="mt-12 border-t border-[var(--border)] pt-8 text-sm text-[var(--muted)] space-y-2">
        <div>{settings.coverageArea}</div>
        <div>{settings.bookingStatus}</div>
        <div>
          <a
            href={`mailto:${settings.contactEmail}`}
            className="underline underline-offset-4"
          >
            {settings.contactEmail}
          </a>
        </div>
      </div>

      <div className="mt-10 flex gap-3 flex-wrap">
        <Link
          href="/inquire"
          className="px-6 py-3 bg-[var(--foreground)] text-[var(--background)] rounded-full hover:opacity-90 transition"
        >
          Start an inquiry
        </Link>
        <Link
          href="/portfolio"
          className="px-6 py-3 border border-[var(--foreground)] rounded-full hover:bg-[var(--foreground)] hover:text-[var(--background)] transition"
        >
          See recent work
        </Link>
      </div>
    </section>
  );
}
