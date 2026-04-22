// Site-wide 404. Rendered whenever a route segment calls `notFound()` and
// no nearer `not-found.tsx` file exists. The site chrome (Nav + Footer)
// is inherited from the root layout — this component returns the page
// body only.
//
// Copy is intentionally warm rather than apologetic: a mistyped URL is
// the most common cause, and "lost" reads better than "error" for
// visitors who may just be browsing.

import Link from "next/link";

export default function NotFound() {
  return (
    <section className="max-w-3xl mx-auto px-6 lg:px-10 py-24 text-center">
      <div className="text-xs uppercase tracking-[0.2em] text-[var(--accent)]">
        404 · Not found
      </div>
      <h1 className="mt-4 font-serif text-5xl">This page wandered off.</h1>
      <p className="mt-5 text-[var(--muted)]">
        The link may be outdated, or the page might have moved as the site
        evolved. The links below cover where most visitors are headed.
      </p>
      <nav className="mt-10 flex flex-wrap justify-center gap-3 text-sm">
        <Link
          href="/"
          className="px-5 py-2 border border-[var(--foreground)] rounded-full hover:bg-[var(--foreground)] hover:text-[var(--background)] transition"
        >
          Home
        </Link>
        <Link
          href="/portfolio"
          className="px-5 py-2 border border-[var(--foreground)] rounded-full hover:bg-[var(--foreground)] hover:text-[var(--background)] transition"
        >
          Portfolio
        </Link>
        <Link
          href="/services"
          className="px-5 py-2 border border-[var(--foreground)] rounded-full hover:bg-[var(--foreground)] hover:text-[var(--background)] transition"
        >
          Services
        </Link>
        <Link
          href="/journal"
          className="px-5 py-2 border border-[var(--foreground)] rounded-full hover:bg-[var(--foreground)] hover:text-[var(--background)] transition"
        >
          Journal
        </Link>
        <Link
          href="/inquire"
          className="px-5 py-2 rounded-full bg-[var(--accent)] text-white hover:opacity-90 transition"
        >
          Inquire
        </Link>
      </nav>
    </section>
  );
}
