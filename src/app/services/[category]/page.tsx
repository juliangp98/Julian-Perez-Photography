import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getService, services } from "@/lib/content";
import PackageCard from "@/components/PackageCard";

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
  return {
    title: `${s.title} · Pricing`,
    description: s.description,
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

  return (
    <section className="max-w-7xl mx-auto px-6 lg:px-10 py-20">
      <Link
        href="/services"
        className="text-xs uppercase tracking-[0.2em] text-[var(--muted)] hover:text-[var(--foreground)]"
      >
        ← All services
      </Link>
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
            <p key={i}>{p}</p>
          ))}
        </div>
      )}

      {s.comboNote && (
        <div className="mt-10 max-w-3xl p-5 border-l-2 border-[var(--accent)] bg-white rounded-r text-[var(--foreground)]/90 italic">
          {s.comboNote}
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
          {s.pricingNote}
        </p>
      )}

      <div className="mt-16 p-10 border border-[var(--border)] rounded-lg bg-white text-center">
        <h2 className="font-serif text-3xl">Ready to chat?</h2>
        <p className="mt-3 text-[var(--muted)] max-w-xl mx-auto">
          Every booking starts with a quick inquiry. Tell me about your vision
          and I&rsquo;ll get back to you within 48 hours.
        </p>
        <div className="mt-6 flex justify-center gap-3 flex-wrap">
          <Link
            href={`/inquire?service=${s.slug}`}
            className="px-6 py-3 bg-[var(--foreground)] text-[var(--background)] rounded-full hover:opacity-90 transition"
          >
            Inquire about {s.title.toLowerCase()}
          </Link>
          <Link
            href="/book"
            className="px-6 py-3 border border-[var(--foreground)] rounded-full hover:bg-[var(--foreground)] hover:text-[var(--background)] transition"
          >
            Book a session
          </Link>
        </div>
      </div>
    </section>
  );
}
