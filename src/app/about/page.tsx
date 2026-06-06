import type { Metadata } from "next";
import { getAboutPage, getSiteSettings } from "@/lib/content";
import SubNav, { ABOUT_TABS } from "@/components/SubNav";
import CalloutCard from "@/components/CalloutCard";

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
      <SubNav items={ABOUT_TABS} />
      <h1 className="mt-8 font-serif text-5xl">{about.heading}</h1>
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

      <div className="mt-12">
        <CalloutCard
          eyebrow="Let's work together"
          title="Ready when you are"
          description="Tell me about your shoot and I'll be in touch — or browse recent work to get a feel for my style first."
          actions={[
            { label: "Start an inquiry", href: "/inquire" },
            { label: "See recent work", href: "/portfolio", variant: "secondary" },
          ]}
        />
      </div>
    </section>
  );
}
