"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export type SubNavItem = { label: string; href: string };

// Tab-style section navigation rendered above a page title — the public-side
// sibling of AdminNav. The active tab (matched by pathname) takes the gold
// accent; the rest are muted with a hover. A bottom rule ties the row to the
// page, the same treatment as the admin sub-nav.
//
// Peer groups (Portfolio/Services, the booking funnel, the client surfaces)
// pass only `items`. A child page that scopes its tabs to one parent — a
// category detail page whose tabs are that category's own portfolio + pricing —
// also passes `back`, a link up to the full index that renders above the tabs.
export default function SubNav({
  items,
  back,
}: {
  items: SubNavItem[];
  back?: SubNavItem;
}) {
  const pathname = usePathname();
  return (
    <div className="border-b border-[var(--border)] pb-4">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        {back && (
          <>
            <Link
              href={back.href}
              className="inline-flex items-center gap-1.5 text-xs uppercase tracking-[0.2em] text-[var(--muted)] transition hover:text-[var(--foreground)]"
            >
              <span aria-hidden>←</span>
              {back.label}
            </Link>
            <span
              aria-hidden
              className="h-4 w-px shrink-0 bg-[var(--border)]"
            />
          </>
        )}
        <nav aria-label="Section" className="flex flex-wrap gap-x-6 gap-y-2">
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
      </div>
    </div>
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

// Post-booking client surfaces. "Plan your session" lives in FUNNEL_TABS (the
// booking funnel), not here, so no page belongs to two bars; the portal's
// project pages link to the questionnaire contextually.
export const CLIENT_TABS: SubNavItem[] = [
  { label: "Client portal", href: "/portal" },
  { label: "Client galleries", href: "/client" },
];

// The booking funnel: a prospect moves left to right — ask a question, plan the
// shoot, then book. "Plan your session" (the questionnaire) is the middle step.
export const FUNNEL_TABS: SubNavItem[] = [
  { label: "Inquire", href: "/inquire" },
  { label: "Plan your session", href: "/questionnaire" },
  { label: "Book", href: "/book" },
  { label: "FAQ", href: "/faq" },
];
