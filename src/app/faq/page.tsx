import type { Metadata } from "next";
import Script from "next/script";
import Link from "next/link";
import { getAllFaqs } from "@/lib/faq";
import { UMBRELLAS } from "@/lib/types";
import { aiEnabled } from "@/lib/ai";
import FaqBrowser from "@/components/FaqBrowser";
import ConciergeChat from "@/components/ConciergeChat";

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
    <section className="max-w-3xl mx-auto px-6 lg:px-10 py-20">
      <Script
        id="ld-faq-index"
        type="application/ld+json"
        strategy="beforeInteractive"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />

      <h1 className="font-serif text-5xl">Frequently asked questions</h1>
      <p className="mt-3 text-[var(--muted)] max-w-2xl">
        Everything about services, pricing, booking, travel, and delivery.
        Search or filter to find your answer — and if it&rsquo;s not here, ask
        below or send an inquiry.
      </p>

      <div className="mt-10">
        <FaqBrowser
          items={items}
          umbrellas={UMBRELLAS.map(({ id, title }) => ({ id, title }))}
        />
      </div>

      {ai && (
        <div className="mt-16 border-t border-[var(--border)] pt-10">
          <h2 className="font-serif text-2xl">Still have a question?</h2>
          <p className="mt-1 mb-4 text-sm text-[var(--muted)]">
            Ask the studio assistant — it can help with services, pricing, and
            booking.
          </p>
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--background)] overflow-hidden">
            <ConciergeChat variant="docked" inquireHref="/inquire" />
          </div>
        </div>
      )}

      <div className="mt-12">
        <Link
          href="/inquire"
          className="inline-block px-6 py-3 border border-[var(--foreground)] rounded-full hover:bg-[var(--foreground)] hover:text-[var(--background)] transition"
        >
          Send an inquiry
        </Link>
      </div>
    </section>
  );
}
