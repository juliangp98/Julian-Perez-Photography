"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  servicesByUmbrella,
  portfoliosByUmbrella,
  siteSettings,
} from "@/lib/content";

const serviceGroups = servicesByUmbrella();
const portfolioGroups = portfoliosByUmbrella();

export default function Nav() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [openSubmenu, setOpenSubmenu] = useState<
    "portfolio" | "services" | "about" | "clients" | null
  >(null);

  // Lock background scroll while the mobile drawer is open so the page
  // doesn't move behind the menu and the drawer's own internal scroll is
  // the only thing that responds to touch. Restored on close + unmount.
  useEffect(() => {
    if (!mobileOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [mobileOpen]);

  // Sanity Studio owns its own full-viewport UI; rendering our site chrome
  // on /studio routes both steals vertical space and clashes with Studio's
  // drag/drop + keyboard shortcuts. Must come AFTER hook declarations so
  // React's hook-order invariant holds across renders.
  if (pathname?.startsWith("/studio")) return null;

  return (
    <header className="sticky top-0 z-40 bg-[var(--background)]/85 backdrop-blur-md border-b border-[var(--border)]">
      <div className="max-w-7xl mx-auto px-6 lg:px-10 h-16 flex items-center justify-between">
        <Link
          href="/"
          className="font-serif text-xl tracking-tight"
          onClick={() => setMobileOpen(false)}
        >
          {siteSettings.siteName}
        </Link>

        {/* Desktop nav */}
        <nav className="hidden lg:flex items-center gap-8 text-sm">
          {/* Portfolio megamenu */}
          <div
            className="relative"
            onMouseEnter={() => setOpenSubmenu("portfolio")}
            onMouseLeave={() => setOpenSubmenu(null)}
          >
            <Link href="/portfolio" className="nav-link">
              Portfolio ▾
            </Link>
            {openSubmenu === "portfolio" && (
              <div className="absolute left-1/2 -translate-x-1/2 top-full pt-3 w-[760px]">
                <div className="bg-[var(--background)] border border-[var(--border)] shadow-xl rounded-lg p-6 grid grid-cols-2 gap-x-8 gap-y-6">
                  {portfolioGroups
                    .filter((g) => g.items.length > 0)
                    .map((g) => (
                      <div key={g.id}>
                        <div className="text-xs uppercase tracking-[0.18em] text-[var(--accent)] mb-2">
                          {g.title}
                        </div>
                        <div className="flex flex-col">
                          {g.items.map((p) => (
                            <Link
                              key={p.slug}
                              href={`/portfolio/${p.slug}`}
                              className="py-1.5 text-sm hover:text-[var(--accent)] transition"
                            >
                              {p.title}
                            </Link>
                          ))}
                        </div>
                      </div>
                    ))}
                  <div className="col-span-2 pt-3 border-t border-[var(--border)] text-xs">
                    <Link
                      href="/portfolio"
                      className="text-[var(--muted)] hover:text-[var(--foreground)]"
                    >
                      View all portfolios →
                    </Link>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Services megamenu */}
          <div
            className="relative"
            onMouseEnter={() => setOpenSubmenu("services")}
            onMouseLeave={() => setOpenSubmenu(null)}
          >
            <Link href="/services" className="nav-link">
              Services &amp; Pricing ▾
            </Link>
            {openSubmenu === "services" && (
              <div className="absolute left-1/2 -translate-x-1/2 top-full pt-3 w-[760px]">
                <div className="bg-[var(--background)] border border-[var(--border)] shadow-xl rounded-lg p-6 grid grid-cols-2 gap-x-8 gap-y-6">
                  {serviceGroups
                    .filter((g) => g.items.length > 0)
                    .map((g) => (
                      <div key={g.id}>
                        <div className="text-xs uppercase tracking-[0.18em] text-[var(--accent)] mb-2">
                          {g.title}
                        </div>
                        <div className="flex flex-col">
                          {g.items.map((s) => (
                            <Link
                              key={s.slug}
                              href={`/services/${s.slug}`}
                              className="py-1.5 text-sm hover:text-[var(--accent)] transition"
                            >
                              {s.title}
                            </Link>
                          ))}
                        </div>
                      </div>
                    ))}
                  <div className="col-span-2 pt-3 border-t border-[var(--border)] text-xs">
                    <Link
                      href="/services"
                      className="text-[var(--muted)] hover:text-[var(--foreground)]"
                    >
                      View all services &amp; pricing →
                    </Link>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* About dropdown — groups the who-is-Julian content (About page +
              Journal) so those two related links stop competing with the CTAs
              in the main nav bar. Trigger itself navigates to /about, matching
              how Portfolio's trigger goes to /portfolio. */}
          <div
            className="relative"
            onMouseEnter={() => setOpenSubmenu("about")}
            onMouseLeave={() => setOpenSubmenu(null)}
          >
            <Link href="/about" className="nav-link">
              About ▾
            </Link>
            {openSubmenu === "about" && (
              <div className="absolute left-1/2 -translate-x-1/2 top-full pt-3 w-56">
                <div className="bg-[var(--background)] border border-[var(--border)] shadow-xl rounded-lg p-4 flex flex-col">
                  <Link
                    href="/about"
                    className="py-1.5 text-sm hover:text-[var(--accent)] transition"
                  >
                    About Julian
                  </Link>
                  <Link
                    href="/journal"
                    className="py-1.5 text-sm hover:text-[var(--accent)] transition"
                  >
                    Journal
                  </Link>
                </div>
              </div>
            )}
          </div>

          {/* Clients dropdown — post-booking client tools (gallery access +
              planning questionnaire). Trigger → /client so clicking behaves
              like the existing Clients link did. */}
          <div
            className="relative"
            onMouseEnter={() => setOpenSubmenu("clients")}
            onMouseLeave={() => setOpenSubmenu(null)}
          >
            <Link href="/client" className="nav-link">
              Clients ▾
            </Link>
            {openSubmenu === "clients" && (
              <div className="absolute left-1/2 -translate-x-1/2 top-full pt-3 w-56">
                <div className="bg-[var(--background)] border border-[var(--border)] shadow-xl rounded-lg p-4 flex flex-col">
                  <Link
                    href="/client"
                    className="py-1.5 text-sm hover:text-[var(--accent)] transition"
                  >
                    Client galleries
                  </Link>
                  <Link
                    href="/questionnaire"
                    className="py-1.5 text-sm hover:text-[var(--accent)] transition"
                  >
                    Plan your session
                  </Link>
                </div>
              </div>
            )}
          </div>

          <Link href="/inquire" className="nav-link">
            Inquire
          </Link>
          <Link
            href="/book"
            className="ml-2 px-4 py-2 bg-[var(--foreground)] text-[var(--background)] rounded-full hover:opacity-90 transition"
          >
            Book
          </Link>
        </nav>

        {/* Mobile toggle */}
        <button
          className="lg:hidden text-sm"
          onClick={() => setMobileOpen((v) => !v)}
          aria-label="Toggle menu"
        >
          {mobileOpen ? "Close" : "Menu"}
        </button>
      </div>

      {/* Mobile drawer.
          The drawer is height-capped to the viewport minus the 4rem header
          (using 100dvh so iOS Safari URL bar collapse doesn't break it) and
          scrolls internally with overscroll-contain so the locked body
          underneath stays put. This handles both portrait and landscape on
          phones where the umbrella-grouped menus would otherwise overflow
          well below the fold. */}
      {mobileOpen && (
        <div className="lg:hidden border-t border-[var(--border)] bg-[var(--background)] max-h-[calc(100dvh-4rem)] overflow-y-auto overscroll-contain">
          <div className="max-w-7xl mx-auto px-6 py-4 pb-10 flex flex-col gap-4 text-sm">
            <details>
              <summary className="cursor-pointer py-2">Portfolio</summary>
              <div className="flex flex-col pl-4 gap-3 mt-2">
                <Link
                  href="/portfolio"
                  onClick={() => setMobileOpen(false)}
                  className="py-1 text-[var(--muted)]"
                >
                  All portfolios
                </Link>
                {portfolioGroups
                  .filter((g) => g.items.length > 0)
                  .map((g) => (
                    <div key={g.id}>
                      <div className="text-[10px] uppercase tracking-[0.18em] text-[var(--accent)] mb-1">
                        {g.title}
                      </div>
                      {g.items.map((p) => (
                        <Link
                          key={p.slug}
                          href={`/portfolio/${p.slug}`}
                          onClick={() => setMobileOpen(false)}
                          className="block py-1"
                        >
                          {p.title}
                        </Link>
                      ))}
                    </div>
                  ))}
              </div>
            </details>
            <details>
              <summary className="cursor-pointer py-2">
                Services &amp; Pricing
              </summary>
              <div className="flex flex-col pl-4 gap-3 mt-2">
                <Link
                  href="/services"
                  onClick={() => setMobileOpen(false)}
                  className="py-1 text-[var(--muted)]"
                >
                  All services
                </Link>
                {serviceGroups
                  .filter((g) => g.items.length > 0)
                  .map((g) => (
                    <div key={g.id}>
                      <div className="text-[10px] uppercase tracking-[0.18em] text-[var(--accent)] mb-1">
                        {g.title}
                      </div>
                      {g.items.map((s) => (
                        <Link
                          key={s.slug}
                          href={`/services/${s.slug}`}
                          onClick={() => setMobileOpen(false)}
                          className="block py-1"
                        >
                          {s.title}
                        </Link>
                      ))}
                    </div>
                  ))}
              </div>
            </details>
            {/* About + Clients get the same disclosure treatment as
                Portfolio/Services above so the mobile drawer groups match
                what desktop shows on hover. The summary acts as both label
                and toggle; tapping a child link closes the drawer. */}
            <details>
              <summary className="cursor-pointer py-2">About</summary>
              <div className="flex flex-col pl-4 gap-2 mt-2">
                <Link
                  href="/about"
                  onClick={() => setMobileOpen(false)}
                  className="py-1"
                >
                  About Julian
                </Link>
                <Link
                  href="/journal"
                  onClick={() => setMobileOpen(false)}
                  className="py-1"
                >
                  Journal
                </Link>
              </div>
            </details>
            <details>
              <summary className="cursor-pointer py-2">Clients</summary>
              <div className="flex flex-col pl-4 gap-2 mt-2">
                <Link
                  href="/client"
                  onClick={() => setMobileOpen(false)}
                  className="py-1"
                >
                  Client galleries
                </Link>
                <Link
                  href="/questionnaire"
                  onClick={() => setMobileOpen(false)}
                  className="py-1"
                >
                  Plan your session
                </Link>
              </div>
            </details>
            <Link href="/inquire" onClick={() => setMobileOpen(false)}>
              Inquire
            </Link>
            <Link
              href="/book"
              onClick={() => setMobileOpen(false)}
              className="mt-2 text-center px-4 py-2 bg-[var(--foreground)] text-[var(--background)] rounded-full"
            >
              Book
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
