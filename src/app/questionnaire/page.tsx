import type { Metadata } from "next";
import Link from "next/link";
import { listQuestionnaires } from "@/lib/questionnaires";
import { getService } from "@/lib/content";
import { UMBRELLAS } from "@/lib/types";

export const metadata: Metadata = {
  title: "Planning questionnaires",
  description:
    "Built-in planning questionnaires for booked clients (and serious prospects). Pick your service and tell me about your day so I can show up prepared.",
};

export default function QuestionnaireIndexPage() {
  const all = listQuestionnaires();

  // Group by umbrella for cleaner scan.
  const grouped = UMBRELLAS.map((u) => ({
    ...u,
    items: all
      .map((q) => ({ q, svc: getService(q.slug) }))
      .filter((x) => x.svc?.umbrella === u.id),
  })).filter((u) => u.items.length > 0);

  return (
    <section className="max-w-7xl mx-auto px-6 lg:px-10 py-20">
      <div className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
        For booked & prospective clients
      </div>
      <h1 className="mt-2 font-serif text-5xl">Planning questionnaires</h1>
      <p className="mt-4 text-[var(--muted)] max-w-2xl">
        These are for prospective and booked clients who already know which
        service they&rsquo;re interested in. Pick yours below and I&rsquo;ll
        get every detail I need to show up prepared. Just have questions
        instead?{" "}
        <Link
          href="/inquire"
          className="underline underline-offset-4 hover:text-[var(--foreground)]"
        >
          Start with a general inquiry
        </Link>
        .
      </p>
      <p className="mt-3 text-[var(--muted)] max-w-2xl text-sm">
        Your answers autosave in your browser, so you can step away and come
        back without losing anything.
      </p>

      {grouped.map((u) => (
              <div key={u.id} className="mt-16">
                <div className="flex items-end justify-between gap-6 flex-wrap mb-6 pb-4 border-b border-[var(--border)]">
                  <div>
                    <div className="text-xs uppercase tracking-[0.2em] text-[var(--accent)]">
                      {u.title}
                    </div>
                    <h2 className="mt-1 font-serif text-3xl">{u.tagline}</h2>
                  </div>
                  <div className="text-xs text-[var(--muted)]">
                    {u.items.length} questionnaire
                    {u.items.length === 1 ? "" : "s"}
                  </div>
                </div>
                <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                  {u.items.map(({ q, svc }) => (
                    <Link
                      key={q.slug}
                      href={`/questionnaire/${q.slug}`}
                      className="group border border-[var(--border)] rounded-lg p-6 bg-white hover:border-[var(--foreground)] transition flex flex-col"
                    >
                      <h3 className="font-serif text-2xl">{svc?.title || q.slug}</h3>
                      <p className="mt-2 text-sm text-[var(--muted)] flex-1">{q.audience}</p>
                      <div className="mt-6 flex items-center justify-between">
                      <div className="text-xs uppercase tracking-widest text-[var(--accent)] group-hover:text-[var(--foreground)]">
                        Get started →
                      </div>
                      <p className="text-xs text-[var(--muted)]">
                        ~{q.estimatedMinutes} min · {q.sections.length} sections
                      </p>
                    </div>
                    </Link>
                  ))}
                </div>
              </div>
            ))}

      <div className="mt-20 p-8 border border-[var(--border)] rounded-lg bg-white max-w-3xl">
        <h2 className="font-serif text-2xl">Don&rsquo;t see your service?</h2>
        <p className="mt-2 text-[var(--muted)]">
          Some services don&rsquo;t need a long-form questionnaire — for those,
          the inquiry form already covers what I need to know.
        </p>
        <div className="mt-5 flex gap-3 flex-wrap">
          <Link
            href="/inquire"
            className="px-5 py-2 bg-[var(--foreground)] text-[var(--background)] rounded-full hover:opacity-90 transition text-sm"
          >
            Send an inquiry
          </Link>
          <Link
            href="/services"
            className="px-5 py-2 border border-[var(--foreground)] rounded-full hover:bg-[var(--foreground)] hover:text-[var(--background)] transition text-sm"
          >
            Browse services
          </Link>
        </div>
      </div>
    </section>
  );
}
