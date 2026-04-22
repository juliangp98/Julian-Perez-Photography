// Skeleton shown while an individual journal post fetches from Sanity.
// The cover-image aspect ratio matches the populated render so the
// layout doesn't shift when the post resolves.

export default function JournalPostLoading() {
  return (
    <article className="max-w-3xl mx-auto px-6 lg:px-10 py-20">
      <div className="h-3 w-20 bg-[var(--border)] rounded animate-pulse" />
      <div className="mt-4 h-10 w-5/6 bg-[var(--border)] rounded animate-pulse" />
      <div className="mt-3 h-4 w-40 bg-[var(--border)] rounded animate-pulse" />
      <div className="mt-10 aspect-[3/2] w-full bg-[var(--border)] rounded animate-pulse" />
      <div className="mt-10 space-y-3">
        <div className="h-4 w-full bg-[var(--border)] rounded animate-pulse" />
        <div className="h-4 w-11/12 bg-[var(--border)] rounded animate-pulse" />
        <div className="h-4 w-10/12 bg-[var(--border)] rounded animate-pulse" />
        <div className="h-4 w-full bg-[var(--border)] rounded animate-pulse" />
        <div className="h-4 w-9/12 bg-[var(--border)] rounded animate-pulse" />
      </div>
    </article>
  );
}
