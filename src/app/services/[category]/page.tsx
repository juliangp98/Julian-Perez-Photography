import Link from "next/link";
import Script from "next/script";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import {
  getPortfolio,
  getService,
  siteSettings,
  visibleServices as services,
} from "@/lib/content";
import PackageCard from "@/components/PackageCard";
import { renderInline } from "@/lib/inline";
import { getQuestionnaire } from "@/lib/questionnaires";

export function generateStaticParams() {
  return services.map((s) => ({ category: s.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ category: string }>;
}): Promise<Metadata> {
  const { category } = await params;
  const s = getService(category);
  if (!s) return {};
  const url = `https://julianperezphotography.com/services/${s.slug}`;
  return {
    title: `${s.title} · Pricing`,
    description: s.description,
    alternates: { canonical: url },
    openGraph: {
      title: `${s.title} · Pricing`,
      description: s.description,
      url,
      type: "website",
    },
  };
}

export default async function ServiceCategoryPage({
  params,
}: {
  params: Promise<{ category: string }>;
}) {
  const { category } = await params;
  const s = getService(category);
  if (!s) notFound();
  const portfolio = getPortfolio(s.slug);
  const questionnaire = getQuestionnaire(s.slug);

  const serviceJsonLd = {
    "@context": "https://schema.org",
    "@type": "Service",
    name: `${s.title} Photography`,
    serviceType: `${s.title} Photography`,
    description: s.description,
    url: `https://julianperezphotography.com/services/${s.slug}`,
    provider: {
      "@type": "LocalBusiness",
      "@id": "https://julianperezphotography.com#business",
    },
    areaServed: [
      { "@type": "AdministrativeArea", name: "Northern Virginia" },
      { "@type": "AdministrativeArea", name: "Washington, DC" },
      { "@type": "AdministrativeArea", name: "Maryland" },
    ],
    hasOfferCatalog: {
      "@type": "OfferCatalog",
      name: `${s.title} Packages`,
      itemListElement: s.packages.map((p) => ({
        "@type": "Offer",
        name: p.name,
        price: p.price.replace(/[^0-9.]/g, "") || undefined,
        priceCurrency: "USD",
        description: p.tagline,
      })),
    },
  };

  const faqJsonLd =
    s.faqs && s.faqs.length > 0
      ? {
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: s.faqs.map((faq) => ({
            "@type": "Question",
            name: faq.question,
            acceptedAnswer: {
              "@type": "Answer",
              text: faq.answer,
            },
          })),
        }
      : null;

  return (
    <section className="max-w-7xl mx-auto px-6 lg:px-10 py-20">
      <Script
        id={`ld-service-${s.slug}`}
        type="application/ld+json"
        strategy="beforeInteractive"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(serviceJsonLd) }}
      />
      {faqJsonLd && (
        <Script
          id={`ld-faq-${s.slug}`}
          type="application/ld+json"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
        />
      )}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <Link
          href="/services"
          className="text-xs uppercase tracking-[0.2em] text-[var(--muted)] hover:text-[var(--foreground)]"
        >
          ← All services
        </Link>
        {portfolio && (
          <Link
            href={`/portfolio/${s.slug}`}
            className="text-xs uppercase tracking-[0.2em] text-[var(--accent)] hover:text-[var(--foreground)]"
          >
            View <span className="hidden sm:inline">{s.title.toLowerCase()} </span>portfolio →
          </Link>
        )}
      </div>
      <div className="mt-4 max-w-3xl">
        <div className="text-xs uppercase tracking-[0.2em] text-[var(--accent)]">
          {s.tagline}
        </div>
        <h1 className="mt-3 font-serif text-5xl">{s.title}</h1>
        <p className="mt-5 text-lg text-[var(--muted)]">{s.description}</p>
      </div>

      {s.intro && s.intro.length > 0 && (
        <div className="mt-12 max-w-3xl space-y-5 text-lg leading-relaxed text-[var(--foreground)]/90">
          {s.intro.map((p, i) => (
            <p key={i}>{renderInline(p)}</p>
          ))}
        </div>
      )}

      {s.comboNote && (
        <div className="mt-10 max-w-3xl p-5 border-l-2 border-[var(--accent)] bg-white rounded-r text-[var(--foreground)]/90 italic">
          {renderInline(s.comboNote)}
        </div>
      )}

      {(() => {
        const hasGroups = s.packages.some((p) => p.group);
        if (!hasGroups) {
          return (
            <div className="mt-14 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {s.packages.map((pkg) => (
                <PackageCard key={pkg.name} pkg={pkg} />
              ))}
            </div>
          );
        }
        // Preserve first-seen order of group labels.
        const groupOrder: string[] = [];
        for (const p of s.packages) {
          const g = p.group ?? "Other";
          if (!groupOrder.includes(g)) groupOrder.push(g);
        }
        return (
          <div className="mt-14 space-y-14">
            {groupOrder.map((label) => {
              const items = s.packages.filter(
                (p) => (p.group ?? "Other") === label,
              );
              return (
                <div key={label}>
                  <h2 className="font-serif text-3xl">{label}</h2>
                  <div className="mt-6 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                    {items.map((pkg) => (
                      <PackageCard key={pkg.name} pkg={pkg} />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        );
      })()}

      {s.addOns && s.addOns.length > 0 && (
        <div className="mt-16 max-w-3xl">
          <h2 className="font-serif text-3xl">Add-ons</h2>
          <ul className="mt-6 border-t border-[var(--border)]">
            {s.addOns.map((a) => (
              <li
                key={a.name}
                className="flex justify-between items-baseline py-4 border-b border-[var(--border)] gap-6"
              >
                <div>
                  <div className="font-medium">{a.name}</div>
                  {a.description && (
                    <div className="text-sm text-[var(--muted)] mt-1">
                      {a.description}
                    </div>
                  )}
                </div>
                <div className="font-serif text-xl whitespace-nowrap">
                  {a.price}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {s.pricingNote && (
        <p className="mt-10 text-sm text-[var(--muted)] italic max-w-2xl">
          {renderInline(s.pricingNote)}
        </p>
      )}

      <div className="mt-16 max-w-3xl p-8 border border-[var(--accent)] rounded-lg bg-white">
        {questionnaire ? (
          <>
            <div className="text-xs uppercase tracking-[0.2em] text-[var(--accent)]">
              Booked or seriously considering?
            </div>
            <h2 className="mt-2 font-serif text-2xl">{questionnaire.title}</h2>
            <p className="mt-2 text-sm text-[var(--muted)]">
              ~{questionnaire.estimatedMinutes} min · autosaves in your browser
            </p>
            <Link
              href={`/questionnaire/${s.slug}`}
              className="mt-4 inline-block px-5 py-2 bg-[var(--foreground)] text-[var(--background)] rounded-full hover:opacity-90 transition text-sm"
            >
              Start the questionnaire →
            </Link>
            <div className="mt-8 pt-8 border-t border-[var(--border)]">
              <div className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
                Or explore another way
              </div>
            </div>
          </>
        ) : (
          <div className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
            Next steps
          </div>
        )}
        <div className="mt-4 flex gap-3 flex-wrap">
          {portfolio && (
            <Link
              href={`/portfolio/${s.slug}`}
              className="px-5 py-2.5 text-sm border border-[var(--foreground)] rounded-full hover:bg-[var(--foreground)] hover:text-[var(--background)] transition"
            >
              View portfolio
            </Link>
          )}
          <Link
            href={`/inquire?service=${s.slug}`}
            className="px-5 py-2.5 text-sm border border-[var(--foreground)] rounded-full hover:bg-[var(--foreground)] hover:text-[var(--background)] transition"
          >
            Inquire
          </Link>
          <Link
            href="/book"
            className="px-5 py-2.5 text-sm border border-[var(--foreground)] rounded-full hover:bg-[var(--foreground)] hover:text-[var(--background)] transition"
          >
            Book a session
          </Link>
          <a
            href={siteSettings.calls.discoveryCall.url}
            target="_blank"
            rel="noopener noreferrer"
            className="px-5 py-2.5 text-sm border border-[var(--foreground)] rounded-full hover:bg-[var(--foreground)] hover:text-[var(--background)] transition"
          >
            Schedule a discovery call
          </a>
        </div>
      </div>
    </section>
  );
}
