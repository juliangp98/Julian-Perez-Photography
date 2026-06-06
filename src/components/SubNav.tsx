"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export type SubNavItem = { label: string; href: string };

// Tab-style section navigation rendered above a page title — the public-side
// sibling of AdminNav. The active tab (matched by pathname) takes the gold
// accent; the rest are muted with a hover. A bottom rule ties the row to the
// page, the same treatment as the admin sub-nav.
export default function SubNav({ items }: { items: SubNavItem[] }) {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Section"
      className="flex flex-wrap gap-x-6 gap-y-2 border-b border-[var(--border)] pb-4"
    >
      {items.map((it) => {
        const active =
          pathname === it.href || pathname?.startsWith(`${it.href}/`);
        return (
          <Link
            key={it.href}
            href={it.href}
            aria-current={active ? "page" : undefined}
            className={`text-xs uppercase tracking-[0.2em] transition ${
              active
                ? "text-[var(--accent)]"
                : "text-[var(--muted)] hover:text-[var(--foreground)]"
            }`}
          >
            {it.label}
          </Link>
        );
      })}
    </nav>
  );
}

// The page groups. Kept here so every page in a group renders the same set.
export const MAIN_TABS: SubNavItem[] = [
  { label: "Portfolio", href: "/portfolio" },
  { label: "Services & Pricing", href: "/services" },
];

export const ABOUT_TABS: SubNavItem[] = [
  { label: "About Julian", href: "/about" },
  { label: "Journal", href: "/journal" },
];

export const CLIENT_TABS: SubNavItem[] = [
  { label: "Client portal", href: "/portal" },
  { label: "Client galleries", href: "/client" },
  { label: "Plan your session", href: "/questionnaire" },
];
