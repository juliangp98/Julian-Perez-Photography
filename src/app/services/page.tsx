import Link from "next/link";
import type { Metadata } from "next";
import { servicesByUmbrella } from "@/lib/content";

export const metadata: Metadata = {
  title: "Services & Pricing",
  description:
    "Wedding, engagement, family, portrait, brand, and event photography packages across the DMV.",
};

export default function ServicesIndex() {
  const groups = servicesByUmbrella().filter((g) => g.items.length > 0);
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
              {group.items.length} service
              {group.items.length === 1 ? "" : "s"}
            </div>
          </div>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {group.items.map((s) => (
              <Link
                key={s.slug}
                href={`/services/${s.slug}`}
                className="group border border-[var(--border)] rounded-lg p-6 bg-white hover:border-[var(--foreground)] transition flex flex-col"
              >
                <h3 className="font-serif text-2xl">{s.title}</h3>
                <p className="mt-2 text-sm text-[var(--muted)] flex-1">
                  {s.tagline}
                </p>
                <div className="mt-6 text-xs uppercase tracking-widest text-[var(--accent)] group-hover:text-[var(--foreground)]">
                  View pricing →
                </div>
              </Link>
            ))}
          </div>
        </div>
      ))}
    </section>
  );
}
