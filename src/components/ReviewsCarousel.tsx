"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// Client-side carousel for the GoogleReviews component. Renders a
// horizontally scrolling rail of review cards with snap behavior, prev/next
// buttons, and pagination dots. Used when GoogleReviews is mounted in
// `variant="carousel"` mode (e.g. on /inquire and /client) so visitors can
// browse the full set of reviews instead of a fixed grid of three.

export type CarouselReview = {
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

export default function ReviewsCarousel({
  reviews,
}: {
  reviews: CarouselReview[];
}) {
  const railRef = useRef<HTMLDivElement | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [canPrev, setCanPrev] = useState(false);
  const [canNext, setCanNext] = useState(true);

  const updateState = useCallback(() => {
    const el = railRef.current;
    if (!el) return;
    const cards = Array.from(el.children) as HTMLElement[];
    if (cards.length === 0) return;
    // Use the rail's scroll position to find the closest snap point.
    const railLeft = el.scrollLeft;
    let closest = 0;
    let closestDelta = Infinity;
    cards.forEach((card, i) => {
      const delta = Math.abs(card.offsetLeft - railLeft);
      if (delta < closestDelta) {
        closestDelta = delta;
        closest = i;
      }
    });
    setActiveIndex(closest);
    setCanPrev(el.scrollLeft > 4);
    setCanNext(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  }, []);

  useEffect(() => {
    const el = railRef.current;
    if (!el) return;
    updateState();
    el.addEventListener("scroll", updateState, { passive: true });
    window.addEventListener("resize", updateState);
    return () => {
      el.removeEventListener("scroll", updateState);
      window.removeEventListener("resize", updateState);
    };
  }, [updateState]);

  const scrollToIndex = useCallback((index: number) => {
    const el = railRef.current;
    if (!el) return;
    const cards = Array.from(el.children) as HTMLElement[];
    const target = cards[Math.max(0, Math.min(cards.length - 1, index))];
    if (!target) return;
    el.scrollTo({ left: target.offsetLeft, behavior: "smooth" });
  }, []);

  const onPrev = () => scrollToIndex(activeIndex - 1);
  const onNext = () => scrollToIndex(activeIndex + 1);

  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "ArrowLeft") {
      e.preventDefault();
      onPrev();
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      onNext();
    }
  };

  return (
    <div className="relative">
      <div
        ref={railRef}
        tabIndex={0}
        onKeyDown={onKeyDown}
        role="region"
        aria-label="Client reviews carousel"
        className="flex gap-5 overflow-x-auto snap-x snap-mandatory scroll-smooth pb-3 -mx-6 px-6 lg:-mx-10 lg:px-10 focus:outline-none"
        style={{ scrollbarWidth: "thin" }}
      >
        {reviews.map((r, i) => (
          <article
            key={`${r.author}-${i}`}
            className="snap-start shrink-0 w-[85%] sm:w-[400px] border border-[var(--border)] rounded-lg p-6 bg-white flex flex-col"
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
            <p className="mt-4 text-sm leading-relaxed text-[var(--foreground)]/90">
              {r.text}
            </p>
          </article>
        ))}
      </div>

      <div className="mt-4 flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          {reviews.map((_, i) => (
            <button
              key={i}
              type="button"
              aria-label={`Go to review ${i + 1}`}
              aria-current={i === activeIndex}
              onClick={() => scrollToIndex(i)}
              className={`h-2 rounded-full transition-all ${
                i === activeIndex
                  ? "w-6 bg-[var(--accent)]"
                  : "w-2 bg-[var(--border)] hover:bg-[var(--muted)]"
              }`}
            />
          ))}
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onPrev}
            disabled={!canPrev}
            aria-label="Previous review"
            className="w-9 h-9 rounded-full border border-[var(--border)] flex items-center justify-center hover:bg-[var(--border)]/40 disabled:opacity-30 disabled:cursor-not-allowed transition"
          >
            ←
          </button>
          <button
            type="button"
            onClick={onNext}
            disabled={!canNext}
            aria-label="Next review"
            className="w-9 h-9 rounded-full border border-[var(--border)] flex items-center justify-center hover:bg-[var(--border)]/40 disabled:opacity-30 disabled:cursor-not-allowed transition"
          >
            →
          </button>
        </div>
      </div>
    </div>
  );
}
