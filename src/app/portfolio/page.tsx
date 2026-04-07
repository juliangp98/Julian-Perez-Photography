import Link from "next/link";
import type { Metadata } from "next";
import { visiblePortfolios as portfolios } from "@/lib/content";

export const metadata: Metadata = {
  title: "Portfolio",
  description: "Wedding, engagement, graduation, portrait, and event portfolios.",
};

export default function PortfolioIndex() {
  return (
    <section className="max-w-7xl mx-auto px-6 lg:px-10 py-20">
      <div className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
        Portfolio
      </div>
      <h1 className="mt-2 font-serif text-5xl">Collections</h1>
      <p className="mt-4 text-[var(--muted)] max-w-2xl">
        Browse by category. Every gallery represents real clients and real
        sessions across the DMV.
      </p>
      <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {portfolios.map((p) => (
          <Link
            key={p.slug}
            href={`/portfolio/${p.slug}`}
            className="group block"
          >
            <div className="aspect-[4/5] bg-[var(--border)]/40 rounded-lg overflow-hidden flex items-end p-6 border border-[var(--border)] group-hover:border-[var(--foreground)] transition">
              <div>
                <h2 className="font-serif text-2xl">{p.title}</h2>
                <p className="mt-1 text-sm text-[var(--muted)]">
                  {p.description}
                </p>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
