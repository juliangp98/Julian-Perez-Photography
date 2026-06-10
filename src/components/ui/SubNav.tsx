"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export type SubNavItem = { label: string; href: string };

// Tab-style section navigation rendered above a page title, used across the
// public page groups AND the authenticated admin + client portals. The active
// tab (matched by pathname) takes the gold accent; the rest are muted with a
// hover. A bottom rule ties the row to the page.
//
// - Peer groups (Portfolio/Services, the booking funnel, the client surfaces)
//   pass only `items`.
// - A child page that scopes its tabs to one parent passes `back`, an inline
//   "← up to the index" link set off from the tabs by a divider.
// - Authenticated portal pages (admin + client) pass `logoutAction`, which adds
//   a right-aligned Sign out form so the one bar is the whole portal chrome.
export default function SubNav({
  items,
  back,
  logoutAction,
}: {
  items: SubNavItem[];
  back?: SubNavItem;
  logoutAction?: string;
}) {
  const pathname = usePathname();
  return (
    <div className="border-b border-[var(--border)] pb-4">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
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
        {logoutAction && (
          <form action={logoutAction} method="post">
            <button
              type="submit"
              className="cursor-pointer border-0 bg-transparent p-0 text-xs uppercase tracking-[0.2em] text-[var(--muted)] transition hover:text-[var(--foreground)]"
            >
              Sign out
            </button>
          </form>
        )}
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

// The owner admin area. Pathname drives the active tab (so /admin/projects/[id]
// highlights Projects); paired with `logoutAction="/admin/logout"`.
export const ADMIN_TABS: SubNavItem[] = [
  { label: "Projects", href: "/admin/projects" },
  { label: "Content", href: "/admin/content" },
  { label: "External links", href: "/admin/links" },
];

// The booking funnel: a prospect moves left to right — ask a question, plan the
// shoot, then book. "Plan your session" (the questionnaire) is the middle step.
export const FUNNEL_TABS: SubNavItem[] = [
  { label: "Inquire", href: "/inquire" },
  { label: "Plan your session", href: "/questionnaire" },
  { label: "Book", href: "/book" },
  { label: "FAQ", href: "/faq" },
];
