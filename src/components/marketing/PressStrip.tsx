import Image from "next/image";
import { pressItems } from "@/lib/press-data";

// "Featured in" strip — publication wordmarks linking to the interviews and
// features in `src/lib/press-data.ts`. Renders nothing when the list is empty
// (FeaturedJournalPost pattern), and is deliberately slimmer than the page's
// full sections: it's a credibility strip, not a content block. The static
// flex-wrap row is right up to roughly a row of logos; if the list outgrows
// that, this is the component to upgrade to a rolling carousel.
export default function PressStrip() {
  if (pressItems.length === 0) return null;
  return (
    <section className="border-t border-[var(--border)]" aria-label="Press features">
      <div className="max-w-7xl mx-auto px-6 lg:px-10 py-14 text-center">
        <div className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
          Featured in
        </div>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-x-12 gap-y-8">
          {pressItems.map((p) => (
            <a
              key={p.url}
              href={p.url}
              target="_blank"
              rel="noreferrer"
              className="group inline-block"
              aria-label={`${p.name} — ${p.title}`}
            >
              {/* Logos are pre-composed circular badges in /public/press/
                  (square PNG, transparent corners) so each publication's mark
                  stays legible on the site's light background regardless of
                  its native colors. */}
              {p.logo ? (
                <Image
                  src={p.logo}
                  alt={`${p.name} logo`}
                  width={480}
                  height={480}
                  className="mx-auto h-20 w-20 rounded-full opacity-85 transition group-hover:opacity-100"
                />
              ) : (
                <span className="font-serif text-2xl text-[var(--muted)] transition group-hover:text-[var(--foreground)]">
                  {p.name}
                </span>
              )}
              <span className="mt-2 block text-xs text-[var(--muted)] transition group-hover:text-[var(--accent)]">
                {p.title} →
              </span>
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}
