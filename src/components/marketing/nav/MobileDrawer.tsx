"use client";

import Link from "next/link";
import {
  serviceGroups,
  portfolioGroups,
  ABOUT_LINKS,
  CLIENT_LINKS,
  type NavLink,
} from "./menu-data";

// The nav's mobile drawer. Height-capped to the viewport minus the 4rem header
// (100dvh so iOS Safari URL-bar collapse doesn't break it) and scrolls
// internally with overscroll-contain while the locked body underneath stays
// put. Disclosure groups mirror the desktop menus; tapping any link calls
// `onNavigate` so the drawer closes.

function LinkList({
  links,
  onNavigate,
}: {
  links: NavLink[];
  onNavigate: () => void;
}) {
  return (
    <div className="flex flex-col pl-4 gap-2 mt-2">
      {links.map((l) => (
        <Link key={l.href} href={l.href} onClick={onNavigate} className="py-1">
          {l.label}
        </Link>
      ))}
    </div>
  );
}

function CatalogList({
  groups,
  hrefBase,
  allHref,
  allLabel,
  onNavigate,
}: {
  groups: { id: string; title: string; items: { slug: string; title: string }[] }[];
  hrefBase: string;
  allHref: string;
  allLabel: string;
  onNavigate: () => void;
}) {
  return (
    <div className="flex flex-col pl-4 gap-3 mt-2">
      <Link href={allHref} onClick={onNavigate} className="py-1 text-[var(--muted)]">
        {allLabel}
      </Link>
      {groups
        .filter((g) => g.items.length > 0)
        .map((g) => (
          <div key={g.id}>
            <div className="text-[10px] uppercase tracking-[0.18em] text-[var(--accent)] mb-1">
              {g.title}
            </div>
            {g.items.map((item) => (
              <Link
                key={item.slug}
                href={`${hrefBase}/${item.slug}`}
                onClick={onNavigate}
                className="block py-1"
              >
                {item.title}
              </Link>
            ))}
          </div>
        ))}
    </div>
  );
}

export default function MobileDrawer({ onNavigate }: { onNavigate: () => void }) {
  return (
    <div className="lg:hidden border-t border-[var(--border)] bg-[var(--background)] max-h-[calc(100dvh-4rem)] overflow-y-auto overscroll-contain">
      <div className="max-w-7xl mx-auto px-6 py-4 pb-10 flex flex-col gap-4 text-sm">
        <details>
          <summary className="cursor-pointer py-2">Portfolio</summary>
          <CatalogList
            groups={portfolioGroups}
            hrefBase="/portfolio"
            allHref="/portfolio"
            allLabel="All portfolios"
            onNavigate={onNavigate}
          />
        </details>
        <details>
          <summary className="cursor-pointer py-2">Services &amp; Pricing</summary>
          <CatalogList
            groups={serviceGroups}
            hrefBase="/services"
            allHref="/services"
            allLabel="All services"
            onNavigate={onNavigate}
          />
        </details>
        <details>
          <summary className="cursor-pointer py-2">About</summary>
          <LinkList links={ABOUT_LINKS} onNavigate={onNavigate} />
        </details>
        <details>
          <summary className="cursor-pointer py-2">Clients</summary>
          <LinkList links={CLIENT_LINKS} onNavigate={onNavigate} />
        </details>
        <Link href="/inquire" onClick={onNavigate}>
          Inquire
        </Link>
        <Link
          href="/book"
          onClick={onNavigate}
          className="mt-2 text-center px-4 py-2 bg-[var(--foreground)] text-[var(--background)] rounded-full"
        >
          Book
        </Link>
      </div>
    </div>
  );
}
