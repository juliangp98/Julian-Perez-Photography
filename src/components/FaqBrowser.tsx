"use client";

// Searchable, filterable FAQ directory for the /faq page. Free-text search runs
// over question + answer; a collection (umbrella) filter narrows to a group,
// with an optional service sub-filter within it. Results stay grouped by
// service (with a "General" bucket) and render as native <details>/<summary>
// accordions, mirroring the service-page FAQ markup for keyboard + screen-
// reader support without a JS dependency.

import { useMemo, useState } from "react";
import Link from "next/link";
import type { FaqItem } from "@/lib/faq";
import type { Umbrella } from "@/lib/types";

type UmbrellaFilter = "all" | "general" | Umbrella;

export type FaqBrowserProps = {
  items: FaqItem[];
  umbrellas: { id: Umbrella; title: string }[];
};

export default function FaqBrowser({ items, umbrellas }: FaqBrowserProps) {
  const [query, setQuery] = useState("");
  const [umbrella, setUmbrella] = useState<UmbrellaFilter>("all");
  const [service, setService] = useState<string>("all");

  function pickUmbrella(next: UmbrellaFilter) {
    setUmbrella(next);
    setService("all"); // service options are scoped to the umbrella
  }

  // Service sub-filter options — distinct services within the active umbrella.
  const serviceOptions = useMemo(() => {
    if (umbrella === "all" || umbrella === "general") return [];
    const seen = new Map<string, string>();
    for (const it of items) {
      if (it.umbrella === umbrella && it.serviceSlug && it.serviceTitle) {
        seen.set(it.serviceSlug, it.serviceTitle);
      }
    }
    return [...seen.entries()].map(([slug, title]) => ({ slug, title }));
  }, [items, umbrella]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((it) => {
      if (umbrella === "general" && it.scope !== "general") return false;
      if (
        umbrella !== "all" &&
        umbrella !== "general" &&
        it.umbrella !== umbrella
      )
        return false;
      if (service !== "all" && it.serviceSlug !== service) return false;
      if (q && !`${it.question} ${it.answer}`.toLowerCase().includes(q))
        return false;
      return true;
    });
  }, [items, umbrella, service, query]);

  // Group results by service (General first), preserving the source order.
  const groups = useMemo(() => {
    const map = new Map<string, FaqItem[]>();
    for (const it of filtered) {
      const label = it.scope === "general" ? "General" : it.serviceTitle ?? "Other";
      if (!map.has(label)) map.set(label, []);
      map.get(label)!.push(it);
    }
    return [...map.entries()];
  }, [filtered]);

  const chip = (active: boolean) =>
    `text-sm rounded-full px-4 py-1.5 border transition ${
      active
        ? "border-[var(--foreground)] bg-[var(--foreground)] text-[var(--background)]"
        : "border-[var(--border)] hover:border-[var(--foreground)]"
    }`;

  return (
    <div>
      {/* Controls */}
      <div className="space-y-4">
        <div>
          <label htmlFor="faq-search" className="sr-only">
            Search frequently asked questions
          </label>
          <input
            id="faq-search"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search questions…"
            className="w-full rounded-lg border border-[var(--border)] bg-white px-4 py-3 focus:outline-none focus:border-[var(--foreground)] transition"
          />
        </div>

        <div
          role="group"
          aria-label="Filter by collection"
          className="flex flex-wrap gap-2"
        >
          <button
            type="button"
            onClick={() => pickUmbrella("all")}
            aria-pressed={umbrella === "all"}
            className={chip(umbrella === "all")}
          >
            All
          </button>
          <button
            type="button"
            onClick={() => pickUmbrella("general")}
            aria-pressed={umbrella === "general"}
            className={chip(umbrella === "general")}
          >
            General
          </button>
          {umbrellas.map((u) => (
            <button
              key={u.id}
              type="button"
              onClick={() => pickUmbrella(u.id)}
              aria-pressed={umbrella === u.id}
              className={chip(umbrella === u.id)}
            >
              {u.title}
            </button>
          ))}
        </div>

        {serviceOptions.length > 0 && (
          <div>
            <label htmlFor="faq-service" className="sr-only">
              Filter by service
            </label>
            <select
              id="faq-service"
              value={service}
              onChange={(e) => setService(e.target.value)}
              className="rounded-lg border border-[var(--border)] bg-white px-4 py-2 text-sm focus:outline-none focus:border-[var(--foreground)] transition"
            >
              <option value="all">All services in this collection</option>
              {serviceOptions.map((s) => (
                <option key={s.slug} value={s.slug}>
                  {s.title}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Results */}
      <p className="mt-6 text-sm text-[var(--muted)]" aria-live="polite">
        {filtered.length} {filtered.length === 1 ? "question" : "questions"}
      </p>

      {groups.length === 0 ? (
        <p className="mt-8 text-[var(--muted)]">
          No questions match that search. Try a different term, or{" "}
          <Link href="/inquire" className="underline underline-offset-4">
            send an inquiry
          </Link>
          .
        </p>
      ) : (
        <div className="mt-4 space-y-10">
          {groups.map(([label, faqs]) => (
            <div key={label}>
              <h2 className="font-serif text-2xl">{label}</h2>
              <div className="mt-3 border-y border-[var(--border)] divide-y divide-[var(--border)]">
                {faqs.map((faq) => (
                  <details key={faq.id} className="group py-5">
                    <summary className="flex justify-between items-baseline gap-6 cursor-pointer list-none font-medium text-base md:text-lg [&::-webkit-details-marker]:hidden">
                      <span>{faq.question}</span>
                      <span
                        aria-hidden
                        className="text-[var(--accent)] text-2xl leading-none transition-transform duration-200 group-open:rotate-45 shrink-0"
                      >
                        +
                      </span>
                    </summary>
                    <div className="mt-3 text-[var(--muted)] leading-relaxed whitespace-pre-line">
                      {faq.answer}
                    </div>
                    {faq.serviceSlug && (
                      <Link
                        href={`/services/${faq.serviceSlug}`}
                        className="mt-3 inline-block text-sm text-[var(--accent)] hover:text-[var(--foreground)] underline underline-offset-4"
                      >
                        View {faq.serviceTitle} details &amp; pricing →
                      </Link>
                    )}
                  </details>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
