// The key static / index pages whose SEO meta descriptions live in code (the
// per-page `metadata.description`). Service + portfolio detail pages derive their
// meta from their on-page description, which the copy polisher already drafts, so
// they're intentionally not listed here. Pure data — shared by the meta-drafting
// route (uses `purpose`) and the admin UI (uses `label`).

export type SeoPage = {
  key: string;
  label: string;
  path: string;
  purpose: string;
};

export const SEO_PAGES: SeoPage[] = [
  {
    key: "home",
    label: "Home",
    path: "/",
    purpose:
      "Homepage introducing Julian Perez — a documentary-style wedding, portrait, and event photographer serving the DMV — and inviting prospective clients to explore his work and reach out.",
  },
  {
    key: "about",
    label: "About",
    path: "/about",
    purpose:
      "Julian's story and approach: who he is, his documentary / candid philosophy, and why couples and families trust him with their day.",
  },
  {
    key: "services",
    label: "Services (index)",
    path: "/services",
    purpose:
      "An overview of every photography service Julian offers — weddings, engagements, families, maternity and newborn, portraits, and events — across the DMV, with a path into each.",
  },
  {
    key: "portfolio",
    label: "Portfolio (index)",
    path: "/portfolio",
    purpose:
      "Galleries of Julian's photography across weddings, couples, family, portraits, and events — a look at his style and the moments he captures.",
  },
  {
    key: "journal",
    label: "Journal",
    path: "/journal",
    purpose:
      "Julian's journal: behind-the-lens stories, real wedding and session recaps, planning tips, and notes on his craft.",
  },
  {
    key: "inquire",
    label: "Inquire / Contact",
    path: "/inquire",
    purpose:
      "Where prospective clients check availability and start a booking — they tell Julian about their date, location, and vision to begin.",
  },
];

export function getSeoPage(key: string): SeoPage | undefined {
  return SEO_PAGES.find((p) => p.key === key);
}
