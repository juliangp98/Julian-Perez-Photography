"use client";

import Link from "next/link";
import { useState } from "react";
import { services, portfolios, siteSettings } from "@/lib/content";

export default function Nav() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [openSubmenu, setOpenSubmenu] = useState<
    "portfolio" | "services" | null
  >(null);

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
          <div
            className="relative"
            onMouseEnter={() => setOpenSubmenu("portfolio")}
            onMouseLeave={() => setOpenSubmenu(null)}
          >
            <Link href="/portfolio" className="nav-link">
              Portfolio ▾
            </Link>
            {openSubmenu === "portfolio" && (
              <div className="absolute left-0 top-full pt-3 w-60">
                <div className="bg-[var(--background)] border border-[var(--border)] shadow-lg rounded-md py-2">
                  {portfolios.map((p) => (
                    <Link
                      key={p.slug}
                      href={`/portfolio/${p.slug}`}
                      className="block px-4 py-2 hover:bg-[var(--border)]/40 transition"
                    >
                      {p.title}
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div
            className="relative"
            onMouseEnter={() => setOpenSubmenu("services")}
            onMouseLeave={() => setOpenSubmenu(null)}
          >
            <Link href="/services" className="nav-link">
              Services &amp; Pricing ▾
            </Link>
            {openSubmenu === "services" && (
              <div className="absolute left-0 top-full pt-3 w-60">
                <div className="bg-[var(--background)] border border-[var(--border)] shadow-lg rounded-md py-2">
                  {services.map((s) => (
                    <Link
                      key={s.slug}
                      href={`/services/${s.slug}`}
                      className="block px-4 py-2 hover:bg-[var(--border)]/40 transition"
                    >
                      {s.title}
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>

          <Link href="/about" className="nav-link">
            About
          </Link>
          <Link href="/client" className="nav-link">
            Clients
          </Link>
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

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="lg:hidden border-t border-[var(--border)] bg-[var(--background)]">
          <div className="max-w-7xl mx-auto px-6 py-4 flex flex-col gap-4 text-sm">
            <details>
              <summary className="cursor-pointer py-2">Portfolio</summary>
              <div className="flex flex-col pl-4 gap-1">
                <Link
                  href="/portfolio"
                  onClick={() => setMobileOpen(false)}
                  className="py-1 text-[var(--muted)]"
                >
                  All portfolios
                </Link>
                {portfolios.map((p) => (
                  <Link
                    key={p.slug}
                    href={`/portfolio/${p.slug}`}
                    onClick={() => setMobileOpen(false)}
                    className="py-1"
                  >
                    {p.title}
                  </Link>
                ))}
              </div>
            </details>
            <details>
              <summary className="cursor-pointer py-2">
                Services &amp; Pricing
              </summary>
              <div className="flex flex-col pl-4 gap-1">
                <Link
                  href="/services"
                  onClick={() => setMobileOpen(false)}
                  className="py-1 text-[var(--muted)]"
                >
                  All services
                </Link>
                {services.map((s) => (
                  <Link
                    key={s.slug}
                    href={`/services/${s.slug}`}
                    onClick={() => setMobileOpen(false)}
                    className="py-1"
                  >
                    {s.title}
                  </Link>
                ))}
              </div>
            </details>
            <Link href="/about" onClick={() => setMobileOpen(false)}>
              About
            </Link>
            <Link href="/client" onClick={() => setMobileOpen(false)}>
              Clients
            </Link>
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
