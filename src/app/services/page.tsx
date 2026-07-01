import Link from "next/link";
import Image from "next/image";
import type { Metadata } from "next";
import { getServicesByUmbrella } from "@/lib/content";
import SubNav, { MAIN_TABS } from "@/components/ui/SubNav";
import CalloutCard from "@/components/ui/CalloutCard";

export const metadata: Metadata = {
  title: "Services & Pricing",
  description:
    "Wedding, engagement, family, portrait, brand, and event photography packages across the DMV.",
};

export default async function ServicesIndex() {
  // Async getter — `getServicesByUmbrella()` resolves from Sanity first
  // (60s cached) and falls back to the hard-coded array when Sanity is
  // unreachable or empty.
  const groups = (await getServicesByUmbrella()).filter(
    (g) => g.items.length > 0,
  );
  return (
    <section className="max-w-7xl mx-auto px-6 lg:px-10 py-20">
      <SubNav items={MAIN_TABS} />
      <h1 className="mt-8 font-serif text-5xl">What I offer</h1>
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
                className="group border border-[var(--border)] rounded-lg overflow-hidden bg-white hover:border-[var(--foreground)] transition flex flex-col"
              >
                {s.heroPhoto && (
                  <div className="relative aspect-[16/10]">
                    <Image
                      src={s.heroPhoto.src}
                      alt=""
                      fill
                      sizes="(max-width: 1024px) 33vw, 100vw"
                      placeholder={s.heroPhoto.blurDataURL ? "blur" : "empty"}
                      blurDataURL={s.heroPhoto.blurDataURL || undefined}
                      className="object-cover transition duration-500 group-hover:scale-[1.02]"
                    />
                  </div>
                )}
                <div className="p-6 flex flex-col flex-1">
                  <h3 className="font-serif text-2xl">{s.title}</h3>
                  <p className="mt-2 text-sm text-[var(--muted)] flex-1">
                    {s.tagline}
                  </p>
                  <div className="mt-6 flex items-center justify-between">
                    <div className="text-xs uppercase tracking-[0.2em] text-[var(--accent)] group-hover:text-[var(--foreground)]">
                      View pricing →
                    </div>
                    <p className="text-xs text-[var(--muted)]">
                      {s.packages.length} packages
                    </p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      ))}

      <div className="mt-20 max-w-3xl">
        <CalloutCard
          eyebrow="Need something custom?"
          title="Don't see your service?"
          description="Some sessions need more of a custom fit. For those, the inquiry form is your friend."
          actions={[
            { label: "Send an inquiry", href: "/inquire" },
            { label: "Browse portfolio", href: "/portfolio", variant: "secondary" },
          ]}
        />
      </div>

    </section>
  );
}
