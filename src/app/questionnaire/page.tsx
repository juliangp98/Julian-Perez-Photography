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
    <section className="max-w-6xl mx-auto px-6 lg:px-10 py-20">
      <div className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
        For booked clients
      </div>
      <h1 className="mt-2 font-serif text-5xl">Planning questionnaires</h1>
      <p className="mt-4 text-[var(--muted)] max-w-2xl">
        Once you&rsquo;re booked (or seriously considering), the next step is
        telling me about your day so I can show up prepared. Each questionnaire
        is tailored to the service — pick yours below.
      </p>
      <p className="mt-3 text-[var(--muted)] max-w-2xl text-sm">
        Your answers autosave in your browser, so you can step away and come
        back without losing anything.
      </p>

      {grouped.map((u) => (
        <div key={u.id} className="mt-16">
          <h2 className="font-serif text-3xl">{u.title}</h2>
          <p className="mt-1 text-sm text-[var(--muted)]">{u.tagline}</p>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {u.items.map(({ q, svc }) => (
              <Link
                key={q.slug}
                href={`/questionnaire/${q.slug}`}
                className="block p-6 border border-[var(--border)] rounded-lg hover:border-[var(--foreground)] transition"
              >
                <div className="text-xs uppercase tracking-[0.2em] text-[var(--accent)]">
                  {svc?.title || q.slug}
                </div>
                <h3 className="mt-2 font-serif text-xl">{q.title}</h3>
                <p className="mt-2 text-sm text-[var(--muted)]">{q.audience}</p>
                <p className="mt-3 text-xs text-[var(--muted)]">
                  ~{q.estimatedMinutes} min · {q.sections.length} sections
                </p>
              </Link>
            ))}
          </div>
        </div>
      ))}

      <div className="mt-20 p-8 border border-[var(--border)] rounded-lg max-w-3xl">
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
