// Journal-specific 404. Rendered when `/journal/[slug]` calls `notFound()`
// because the requested post slug either never existed or was unpublished.
// Nested under the slug segment so the "back to journal" pathway stays
// obvious — visitors landing here almost always want the index rather
// than the root site 404.

import Link from "next/link";

export default function JournalPostNotFound() {
  return (
    <section className="max-w-3xl mx-auto px-6 lg:px-10 py-24 text-center">
      <div className="text-xs uppercase tracking-[0.2em] text-[var(--accent)]">
        Journal · not found
      </div>
      <h1 className="mt-4 font-serif text-5xl">
        That story isn&apos;t here.
      </h1>
      <p className="mt-5 text-[var(--muted)]">
        It may have been unpublished or moved. The full journal index is a
        good place to start.
      </p>
      <div className="mt-10 flex flex-wrap justify-center gap-3 text-sm">
        <Link
          href="/journal"
          className="px-5 py-2 border border-[var(--foreground)] rounded-full hover:bg-[var(--foreground)] hover:text-[var(--background)] transition"
        >
          All journal posts
        </Link>
        <Link
          href="/"
          className="px-5 py-2 rounded-full bg-[var(--accent)] text-white hover:opacity-90 transition"
        >
          Back to home
        </Link>
      </div>
    </section>
  );
}
