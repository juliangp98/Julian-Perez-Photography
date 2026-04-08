import Link from "next/link";
import type { Metadata } from "next";
import { portfoliosByUmbrella } from "@/lib/content";

export const metadata: Metadata = {
  title: "Portfolio",
  description:
    "Wedding, engagement, family, portrait, brand, and event portfolios from across the DMV.",
};

export default function PortfolioIndex() {
  const groups = portfoliosByUmbrella().filter((g) => g.items.length > 0);
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

      {groups.map((group) => (
        <div key={group.id} className="mt-16">
          <div className="flex items-end justify-between gap-6 flex-wrap mb-6 pb-4 border-b border-[var(--border)]">
            <div>
              <div className="text-xs uppercase tracking-[0.2em] text-[var(--accent)]">
                {group.title}
              </div>
              <h2 className="mt-1 font-serif text-3xl">{group.tagline}</h2>
            </div>
            <div className="text-xs text-[var(--muted)]">
              {group.items.length} collection
              {group.items.length === 1 ? "" : "s"}
            </div>
          </div>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {group.items.map((p) => (
              <Link
                key={p.slug}
                href={`/portfolio/${p.slug}`}
                className="group block"
              >
                <div className="aspect-[4/5] bg-[var(--border)]/40 rounded-lg overflow-hidden flex items-end p-6 border border-[var(--border)] group-hover:border-[var(--foreground)] transition">
                  <div>
                    <h3 className="font-serif text-2xl">{p.title}</h3>
                    <p className="mt-1 text-sm text-[var(--muted)]">
                      {p.description}
                    </p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      ))}
    </section>
  );
}
