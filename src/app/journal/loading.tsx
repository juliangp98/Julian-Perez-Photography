// Skeleton shown while the journal index fetches from Sanity. The grid
// shape mirrors the populated layout so there's no jarring reflow once
// the posts resolve. Tailwind's `animate-pulse` carries the loading cue
// without additional CSS.

export default function JournalLoading() {
  return (
    <section className="max-w-7xl mx-auto px-6 lg:px-10 py-20">
      <div className="max-w-2xl">
        <div className="h-3 w-24 bg-[var(--border)] rounded animate-pulse" />
        <div className="mt-4 h-12 w-3/4 bg-[var(--border)] rounded animate-pulse" />
        <div className="mt-4 h-4 w-full bg-[var(--border)] rounded animate-pulse" />
        <div className="mt-2 h-4 w-2/3 bg-[var(--border)] rounded animate-pulse" />
      </div>
      <div className="mt-16 grid gap-10 md:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i}>
            <div className="aspect-[4/3] w-full bg-[var(--border)] rounded animate-pulse" />
            <div className="mt-4 h-3 w-20 bg-[var(--border)] rounded animate-pulse" />
            <div className="mt-3 h-6 w-5/6 bg-[var(--border)] rounded animate-pulse" />
            <div className="mt-2 h-4 w-full bg-[var(--border)] rounded animate-pulse" />
          </div>
        ))}
      </div>
    </section>
  );
}
