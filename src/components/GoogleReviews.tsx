import { fetchGoogleReviews } from "@/lib/google-reviews";

// Async server component. Fetches Google reviews and renders them in a
// grid. If no env vars are set or Google returns nothing, returns null
// so the consumer page just renders without a reviews section.
//
// Display follows Google's Places API attribution requirements:
// reviewer name, profile photo (when provided), star rating, relative
// publish time, original review text, and a "Powered by Google" link
// to the business's Maps listing. Review text is not modified.

type Props = {
  heading?: string;
  limit?: number;
  className?: string;
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

export default async function GoogleReviews({
  heading = "What clients say",
  limit = 3,
  className = "",
}: Props) {
  const { reviews, rating, reviewCount, mapsUrl, businessName } =
    await fetchGoogleReviews();
  if (reviews.length === 0) return null;
  const shown = reviews.slice(0, limit);

  return (
    <section className={className}>
      <div className="flex items-end justify-between gap-6 flex-wrap mb-8">
        <div>
          <div className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
            Reviews
          </div>
          <h2 className="mt-2 font-serif text-4xl">{heading}</h2>
        </div>
        {rating != null && (
          <div className="text-sm text-[var(--muted)]">
            <span className="text-[var(--accent)] font-medium">
              ★ {rating.toFixed(1)}
            </span>{" "}
            ·{" "}
            {reviewCount != null && (
              <>
                {reviewCount} review{reviewCount === 1 ? "" : "s"} on{" "}
              </>
            )}
            {mapsUrl ? (
              <a
                href={mapsUrl}
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

      <div className="mt-6 text-xs text-[var(--muted)]">
        {mapsUrl ? (
          <a
            href={mapsUrl}
            target="_blank"
            rel="noreferrer"
            className="underline underline-offset-4 hover:text-[var(--foreground)]"
          >
            Powered by Google
            {businessName ? ` · See all reviews for ${businessName}` : ""}
          </a>
        ) : (
          "Powered by Google"
        )}
      </div>
    </section>
  );
}
