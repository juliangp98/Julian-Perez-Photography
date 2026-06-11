import type { Metadata } from "next";
import { getAboutPage, getSiteSettings } from "@/lib/content";
import Image from "next/image";
import SubNav, { ABOUT_TABS } from "@/components/ui/SubNav";
import CalloutCard from "@/components/ui/CalloutCard";
import { pressItems } from "@/lib/press-data";

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
  const images = about.images ?? [];
  return (
    <section className="max-w-7xl mx-auto px-6 lg:px-10 py-20">
      <SubNav items={ABOUT_TABS} />
      <h1 className="mt-8 font-serif text-5xl">{about.heading}</h1>

      <div className="mt-8 lg:grid lg:grid-cols-3 lg:gap-12 lg:items-start">
        <div
          className={`space-y-5 text-lg leading-relaxed text-[var(--foreground)]/90 ${
            images.length > 0 ? "lg:col-span-2" : "max-w-3xl"
          }`}
        >
          {about.bio.map((paragraph, i) => (
            <p key={i}>{paragraph}</p>
          ))}
          {pressItems.length > 0 && (
            <div className="pt-2 text-sm text-[var(--muted)]">
              As featured in{" "}
              {pressItems.map((p, i) => (
                <span key={p.url}>
                  {i > 0 && ", "}
                  <a
                    href={p.url}
                    target="_blank"
                    rel="noreferrer"
                    className="underline underline-offset-4 hover:text-[var(--accent)]"
                  >
                    {p.name}: {p.title} →
                  </a>
                </span>
              ))}
            </div>
          )}
        </div>
        {images.length > 0 && (
          <aside className="mt-10 lg:mt-0 lg:sticky lg:top-24 space-y-5">
            {images.slice(0, 3).map((src) => (
              <div
                key={src}
                className="relative aspect-[4/5] overflow-hidden rounded-lg border border-[var(--border)]"
              >
                <Image
                  src={src}
                  alt=""
                  fill
                  sizes="(max-width: 1024px) 100vw, 33vw"
                  className="object-cover"
                />
              </div>
            ))}
          </aside>
        )}
      </div>

      <div className="mt-12 max-w-3xl border-t border-[var(--border)] pt-8 text-sm text-[var(--muted)] space-y-2">
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

      <div className="mt-12 max-w-3xl">
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
