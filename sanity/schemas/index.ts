import { siteSettings } from "./siteSettings";
import { categoryUmbrella } from "./categoryUmbrella";
import {
  serviceCategory,
  pkg,
  addOn,
} from "./serviceCategory";
import { portfolioCategory } from "./portfolioCategory";
import { aboutPage } from "./aboutPage";
import { journalPost } from "./journalPost";

// `schemaTypes` is the full catalog — the Studio config (sanity.config.ts) is
// free to register a narrower set so dormant schemas stay invisible to editors
// until their rendering side ships.
export const schemaTypes = [
  siteSettings,
  categoryUmbrella,
  serviceCategory,
  pkg,
  addOn,
  portfolioCategory,
  aboutPage,
  journalPost,
];

export {
  journalPost,
  categoryUmbrella,
  serviceCategory,
  pkg,
  addOn,
  portfolioCategory,
  aboutPage,
};
