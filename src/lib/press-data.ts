// Pure-data module: the site's press features and accolades, newest first.
// Rendered by `PressStrip` (home page) and the "As featured in" line on the
// About page — append an item here and both surfaces pick it up. Code-only by
// design (no Sanity counterpart): press changes a few times a year at most, so
// the flat-data convention covers it; promote to a Sanity type only if that
// stops being true.
//
// `logo` points into /public/press/ (a transparent wordmark, displayed at
// ~40px height). Omit it and the strip renders the publication name as a
// styled text wordmark instead — useful while an asset is pending.

export type PressItem = {
  name: string;
  title: string;
  url: string;
  logo?: string;
};

export const pressItems: PressItem[] = [
  {
    name: "VoyageBaltimore",
    title: "Community Highlights: Meet Julian Perez",
    url: "https://voyagebaltimore.com/interview/community-highlights-meet-julian-perez-of-julian-perez-photography",
    logo: "/press/voyagebaltimore.png",
  },
];
