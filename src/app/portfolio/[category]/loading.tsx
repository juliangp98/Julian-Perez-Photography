// Skeleton shown while a portfolio category fetches its metadata and
// image manifest. The gallery placeholder preserves the final grid
// shape so there's no reflow when images resolve.

export default function PortfolioCategoryLoading() {
  return (
    <section className="max-w-7xl mx-auto px-6 lg:px-10 py-20">
      <div className="h-3 w-28 bg-[var(--border)] rounded animate-pulse" />
      <div className="mt-4 h-12 w-1/2 bg-[var(--border)] rounded animate-pulse" />
      <div className="mt-3 h-4 w-2/3 bg-[var(--border)] rounded animate-pulse" />
      <div className="mt-12 grid gap-3 grid-cols-2 md:grid-cols-3">
        {Array.from({ length: 9 }).map((_, i) => (
          <div
            key={i}
            className="aspect-square w-full bg-[var(--border)] rounded animate-pulse"
          />
        ))}
      </div>
    </section>
  );
}
