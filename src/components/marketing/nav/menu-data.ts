import {
  servicesByUmbrellaFallback,
  portfoliosByUmbrellaFallback,
} from "@/lib/content";

// The nav's menu contents, shared by the desktop megamenus/dropdowns and the
// mobile drawer so the two presentations can never drift. The grouped catalogs
// come from the sync *Fallback content getters (the nav is a client component
// and can't await the async ones); staleness cadence is "restructure the
// catalog → redeploy," which matches how that class of change ships anyway.

export const serviceGroups = servicesByUmbrellaFallback();
export const portfolioGroups = portfoliosByUmbrellaFallback();

export type NavLink = { href: string; label: string };

// About — the who-is-Julian content (About page + Journal).
export const ABOUT_LINKS: NavLink[] = [
  { href: "/about", label: "About Julian" },
  { href: "/journal", label: "Journal" },
];

// Clients — post-booking tools (portal, galleries, planning questionnaire).
export const CLIENT_LINKS: NavLink[] = [
  { href: "/portal", label: "Client portal" },
  { href: "/client", label: "Client galleries" },
  { href: "/questionnaire", label: "Plan your session" },
];
