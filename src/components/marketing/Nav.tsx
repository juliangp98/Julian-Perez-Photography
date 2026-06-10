"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { siteSettingsFallback } from "@/lib/content";
import {
  serviceGroups,
  portfolioGroups,
  ABOUT_LINKS,
  CLIENT_LINKS,
} from "@/components/marketing/nav/menu-data";
import { MegaMenu, DropdownMenu } from "@/components/marketing/nav/menus";
import MobileDrawer from "@/components/marketing/nav/MobileDrawer";

// Site header: sticky bar with hover megamenus/dropdowns on desktop and a
// disclosure drawer on mobile. The menu contents live in `nav/menu-data.ts`
// (one source for both presentations); the panels in `nav/menus.tsx`; the
// drawer in `nav/MobileDrawer.tsx`. Nav itself owns the open/close state.
// It's a client component (it needs `usePathname()` to hide itself on
// /studio), so the menu data comes from the sync *Fallback content getters.

type Submenu = "portfolio" | "services" | "about" | "clients";

// Hover wrapper for a desktop menu trigger: the link navigates, hovering opens
// the panel rendered by `children`. Open-state lives in Nav and arrives via
// props so the wrapper stays a static component.
function HoverMenu({
  menu,
  href,
  label,
  openSubmenu,
  setOpenSubmenu,
  children,
}: {
  menu: Submenu;
  href: string;
  label: string;
  openSubmenu: Submenu | null;
  setOpenSubmenu: (m: Submenu | null) => void;
  children: React.ReactNode;
}) {
  return (
    <div
      className="relative"
      onMouseEnter={() => setOpenSubmenu(menu)}
      onMouseLeave={() => setOpenSubmenu(null)}
    >
      <Link href={href} className="nav-link">
        {label} ▾
      </Link>
      {openSubmenu === menu && children}
    </div>
  );
}

export default function Nav() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [openSubmenu, setOpenSubmenu] = useState<Submenu | null>(null);

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

  // Sanity Studio owns its own full-viewport UI; rendering the site
  // chrome on /studio routes both steals vertical space and clashes
  // with Studio's drag/drop + keyboard shortcuts. Must come AFTER hook
  // declarations so React's hook-order invariant holds across renders.
  if (pathname?.startsWith("/studio")) return null;

  const menuProps = { openSubmenu, setOpenSubmenu };

  return (
    <header className="sticky top-0 z-40 bg-[var(--background)]/85 backdrop-blur-md border-b border-[var(--border)]">
      <div className="max-w-7xl mx-auto px-6 lg:px-10 h-16 flex items-center justify-between">
        <Link
          href="/"
          className="font-serif text-xl tracking-tight"
          onClick={() => setMobileOpen(false)}
        >
          {siteSettingsFallback.siteName}
        </Link>

        {/* Desktop nav */}
        <nav className="hidden lg:flex items-center gap-8 text-sm">
          <HoverMenu menu="portfolio" href="/portfolio" label="Portfolio" {...menuProps}>
            <MegaMenu
              groups={portfolioGroups}
              hrefBase="/portfolio"
              viewAllHref="/portfolio"
              viewAllLabel="View all portfolios →"
            />
          </HoverMenu>
          <HoverMenu menu="services" href="/services" label="Services & Pricing" {...menuProps}>
            <MegaMenu
              groups={serviceGroups}
              hrefBase="/services"
              viewAllHref="/services"
              viewAllLabel="View all services & pricing →"
            />
          </HoverMenu>
          {/* About groups the who-is-Julian content; Clients groups the
              post-booking tools. Each trigger navigates like a plain link. */}
          <HoverMenu menu="about" href="/about" label="About" {...menuProps}>
            <DropdownMenu links={ABOUT_LINKS} />
          </HoverMenu>
          <HoverMenu menu="clients" href="/client" label="Clients" {...menuProps}>
            <DropdownMenu links={CLIENT_LINKS} />
          </HoverMenu>

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

      {mobileOpen && <MobileDrawer onNavigate={() => setMobileOpen(false)} />}
    </header>
  );
}
