import Link from "next/link";
import type { Metadata } from "next";
import { visibleServices as services } from "@/lib/content";

export const metadata: Metadata = {
  title: "Services & Pricing",
  description:
    "Wedding, engagement, graduation, portrait, and event photography packages.",
};

export default function ServicesIndex() {
  return (
    <section className="max-w-7xl mx-auto px-6 lg:px-10 py-20">
      <div className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
        Services &amp; Pricing
      </div>
      <h1 className="mt-2 font-serif text-5xl">What I offer</h1>
      <p className="mt-4 text-[var(--muted)] max-w-2xl">
        Every session starts with a conversation. Pick the service that fits
        and I&rsquo;ll walk you through the details on a quick call or email.
      </p>
      <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {services.map((s) => (
          <Link
            key={s.slug}
            href={`/services/${s.slug}`}
            className="group border border-[var(--border)] rounded-lg p-6 bg-white hover:border-[var(--foreground)] transition flex flex-col"
          >
            <h2 className="font-serif text-2xl">{s.title}</h2>
            <p className="mt-2 text-sm text-[var(--muted)] flex-1">
              {s.tagline}
            </p>
            <div className="mt-6 text-xs uppercase tracking-widest text-[var(--accent)] group-hover:text-[var(--foreground)]">
              View pricing →
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
