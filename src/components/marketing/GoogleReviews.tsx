import { fetchGoogleReviews } from "@/lib/google-reviews";
import { getSiteSettings } from "@/lib/content";
import type { Testimonial } from "@/lib/types";
import ReviewsCarousel from "./ReviewsCarousel";

// Async server component. Renders client testimonials in a grid. Pulls
// from the Google Places API when env vars are set and the business is
// API-visible; otherwise falls back to the manually curated
// `testimonials` list on the Sanity-backed site settings (or the
// hard-coded fallback when Sanity is unconfigured). If both are empty,
// returns null so the consumer page renders without a reviews section.
//
// API display follows Google's Places attribution requirements:
// reviewer name, profile photo (when provided), star rating, relative
// publish time, original review text, and a link to the GBP. Review
// text is not modified.

type Props = {
  heading?: string;
  limit?: number;
  className?: string;
  // "grid" (default) renders up to `limit` cards in a static responsive
  // grid. "carousel" renders ALL available reviews in a horizontally
  // scrolling client component with prev/next + dot pagination — used on
  // pages where visitors are likely to want to browse the full set
  // (/inquire, /client). The `limit` prop is ignored in carousel mode.
  variant?: "grid" | "carousel";
};

type DisplayReview = {
  author: string;
  authorPhotoUrl: string | null;
  rating: number;
  relativeTime: string;
  text: string;
};

function Stars({ rating }: { rating: number }) {
  const rounded = Math.round(rating);
  return (
    <div
      aria-label={`${rating} out of 5 stars`}
      className="text-[var(--accent)] tracking-widest text-sm"
    >
      {"★".repeat(rounded)}
      <span className="text-[var(--border)]">{"★".repeat(5 - rounded)}</span>
    </div>
  );
}

function testimonialToDisplay(t: Testimonial): DisplayReview {
  return {
    author: t.author,
    authorPhotoUrl: null,
    rating: t.rating,
    relativeTime: t.relativeTime,
    text: t.text,
  };
}

export default async function GoogleReviews({
  heading = "What clients say",
  limit = 3,
  className = "",
  variant = "grid",
}: Props) {
  const [{ reviews, rating, reviewCount, mapsUrl, businessName }, settings] =
    await Promise.all([fetchGoogleReviews(), getSiteSettings()]);

  // Prefer live API data; fall back to curated testimonials.
  let display: DisplayReview[];
  let aggregateRating: number | null;
  let aggregateCount: number | null;
  let attributionUrl: string | null;
  let attributionLabel: string;

  if (reviews.length > 0) {
    display = reviews;
    aggregateRating = rating;
    aggregateCount = reviewCount;
    attributionUrl = mapsUrl;
    attributionLabel = `Powered by Google${
      businessName ? ` · See all reviews for ${businessName}` : ""
    }`;
  } else if (settings.testimonials.length > 0) {
    display = settings.testimonials.map(testimonialToDisplay);
    const avg =
      display.reduce((sum, r) => sum + r.rating, 0) / display.length;
    aggregateRating = Number(avg.toFixed(1));
    aggregateCount = settings.testimonials.length;
    attributionUrl = settings.googleProfileUrl ?? null;
    attributionLabel = "Reviews from Google Business Profile";
  } else {
    return null;
  }

  // Carousel mode shows everything; grid mode obeys the `limit` prop.
  const shown = variant === "carousel" ? display : display.slice(0, limit);

  return (
    <section className={className}>
      <div className="flex items-end justify-between gap-6 flex-wrap mb-8">
        <div>
          <div className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
            Reviews
          </div>
          <h2 className="mt-2 font-serif text-4xl">{heading}</h2>
        </div>
        {aggregateRating != null && (
          <div className="text-sm text-[var(--muted)]">
            <span className="text-[var(--accent)] font-medium">
              ★ {aggregateRating.toFixed(1)}
            </span>{" "}
            ·{" "}
            {aggregateCount != null && (
              <>
                {aggregateCount} review{aggregateCount === 1 ? "" : "s"} on{" "}
              </>
            )}
            {attributionUrl ? (
              <a
                href={attributionUrl}
                target="_blank"
                rel="noreferrer"
                className="underline underline-offset-4 hover:text-[var(--foreground)]"
              >
                Google
              </a>
            ) : (
              "Google"
            )}
          </div>
        )}
      </div>

      {variant === "carousel" ? (
        <ReviewsCarousel reviews={shown} />
      ) : (
        <div
          className={`grid gap-5 ${
            shown.length >= 3
              ? "sm:grid-cols-2 lg:grid-cols-3"
              : "sm:grid-cols-2"
          }`}
        >
          {shown.map((r, i) => (
            <article
              key={`${r.author}-${i}`}
              className="border border-[var(--border)] rounded-lg p-6 bg-white flex flex-col"
            >
              <div className="flex items-center gap-3">
                {r.authorPhotoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={r.authorPhotoUrl}
                    alt={`${r.author} profile photo`}
                    width={40}
                    height={40}
                    className="rounded-full w-10 h-10 object-cover"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-[var(--border)]/60 flex items-center justify-center text-xs font-medium">
                    {r.author.slice(0, 1)}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{r.author}</div>
                  <div className="text-xs text-[var(--muted)]">
                    {r.relativeTime}
                  </div>
                </div>
              </div>
              <div className="mt-3">
                <Stars rating={r.rating} />
              </div>
              <p className="mt-4 text-sm leading-relaxed text-[var(--foreground)]/90 line-clamp-6">
                {r.text}
              </p>
            </article>
          ))}
        </div>
      )}

      <div className="mt-6 text-xs text-[var(--muted)]">
        {attributionUrl ? (
          <a
            href={attributionUrl}
            target="_blank"
            rel="noreferrer"
            className="underline underline-offset-4 hover:text-[var(--foreground)]"
          >
            {attributionLabel}
          </a>
        ) : (
          attributionLabel
        )}
      </div>
    </section>
  );
}
