import type { Metadata } from "next";
import Script from "next/script";
import Button from "@/components/ui/Button";
import { getAllFaqs } from "@/lib/faq";
import { UMBRELLAS } from "@/lib/types";
import { aiEnabled } from "@/lib/ai/ai";
import FaqBrowser from "@/components/marketing/FaqBrowser";
import ConciergeChat from "@/components/marketing/ConciergeChat";
import SubNav, { FUNNEL_TABS } from "@/components/ui/SubNav";

export const metadata: Metadata = {
  title: "FAQ",
  description:
    "Answers to common questions about Julian Perez Photography — services, pricing, booking, travel, and photo delivery across the DMV.",
  alternates: { canonical: "/faq" },
};

// Consolidated, crawlable FAQ directory. The same FAQ set grounds the
// concierge chat, so the page and the assistant always agree.
export default async function FaqPage() {
  const items = await getAllFaqs();
  const ai = aiEnabled();

  // One FAQPage block covering every question on this URL. (Per-service pages
  // emit their own FAQPage for their subset; Google attributes rich results
  // per-page, so the consolidated set here is fine.)
  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((f) => ({
      "@type": "Question",
      name: f.question,
      acceptedAnswer: { "@type": "Answer", text: f.answer },
    })),
  };

  return (
    <section className="max-w-7xl mx-auto px-6 lg:px-10 py-20">
      <Script
        id="ld-faq-index"
        type="application/ld+json"
        strategy="beforeInteractive"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />

      <SubNav items={FUNNEL_TABS} />

      <h1 className="mt-6 font-serif text-5xl">Frequently asked questions</h1>
      <p className="mt-3 text-[var(--muted)] max-w-2xl">
        Everything about services, pricing, booking, travel, and delivery.
        Search or filter to find your answer — and if it&rsquo;s not here, ask
        below or send an inquiry.
      </p>

      <div
        className={`mt-10 ${
          ai ? "lg:grid lg:grid-cols-3 lg:gap-12 lg:items-start" : ""
        }`}
      >
        <div className={ai ? "lg:col-span-2" : undefined}>
          <FaqBrowser
            items={items}
            umbrellas={UMBRELLAS.map(({ id, title }) => ({ id, title }))}
          />
        </div>

        {ai && (
          <aside className="mt-12 lg:mt-0 lg:sticky lg:top-24">
            <h2 className="font-serif text-2xl">Still have a question?</h2>
            <p className="mt-1 mb-4 text-sm text-[var(--muted)]">
              Ask the studio assistant — it can help with services, pricing, and
              booking.
            </p>
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--background)] overflow-hidden">
              <ConciergeChat variant="docked" inquireHref="/inquire" />
            </div>
          </aside>
        )}
      </div>

      <div className="mt-12">
        <Button href="/inquire" variant="secondary" size="lg">
          Send an inquiry
        </Button>
      </div>
    </section>
  );
}
