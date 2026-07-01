import Link from "next/link";
import Image from "next/image";
import type { Metadata } from "next";
import { getPortfoliosByUmbrella } from "@/lib/content";
import SubNav, { MAIN_TABS } from "@/components/ui/SubNav";

export const metadata: Metadata = {
  title: "Portfolio",
  description:
    "Wedding, engagement, family, portrait, brand, and event portfolios from across the DMV.",
};

// Async — portfolios live in Sanity with a 60s revalidate + cache tag
// (same pattern as /services).
export default async function PortfolioIndex() {
  const groups = (await getPortfoliosByUmbrella()).filter(
    (g) => g.items.length > 0,
  );
  return (
    <section className="max-w-7xl mx-auto px-6 lg:px-10 py-20">
      <SubNav items={MAIN_TABS} />
      <h1 className="mt-8 font-serif text-5xl">Collections</h1>
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
            {group.items.map((p) => {
              // Cover thumbnail: a hand-picked Studio cover, else the first
              // gallery image (Sanity or manifest); otherwise text-on-muted.
              const cover = p.coverPhoto ?? p.images[0];
              return (
                <Link
                  key={p.slug}
                  href={`/portfolio/${p.slug}`}
                  className="group block"
                >
                  <div className="relative aspect-[4/5] bg-[var(--border)]/40 rounded-lg overflow-hidden flex items-end p-6 border border-[var(--border)] group-hover:border-[var(--foreground)] transition">
                    {cover && (
                      <>
                        <Image
                          src={cover.src}
                          alt=""
                          fill
                          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                          placeholder={cover.blurDataURL ? "blur" : "empty"}
                          blurDataURL={cover.blurDataURL || undefined}
                          className="object-cover transition duration-500 group-hover:scale-[1.02]"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
                      </>
                    )}
                    <div className="relative">
                      <h3
                        className={`font-serif text-2xl ${cover ? "text-white" : ""}`}
                      >
                        {p.title}
                      </h3>
                      <p
                        className={`mt-1 text-sm ${cover ? "text-white/80" : "text-[var(--muted)]"}`}
                      >
                        {p.description}
                      </p>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </section>
  );
}
